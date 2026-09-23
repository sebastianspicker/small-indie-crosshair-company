#!/usr/bin/env python3
"""Legacy CS2 crosshair geometry audit and conditional post-update candidates.

Research date: 2026-09-23. This does not run CS2 or verify its new renderer.
The legacy model is the CS2KZ reconstruction, not Valve-released client source.
No dependencies, network requests, game-file modifications, or game process access.
Share-code field decoding follows akiver/csgo-sharecode (see SOURCES.md).
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import re
import struct
import sys
from typing import Any

ALPHABET = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789'
HEIGHTS = (720, 768, 960, 1024, 1080, 1440, 2160)
# These are fixed, pre-update match observations, not claims of present preferences.
PROS = (
    ('donk', '2026-08-31', 'CSGO-aNQn2-upV5w-M8dOd-OOwcf-2pFKO', 'donk'),
    ('ZywOo', '2026-09-04', 'CSGO-hzGdv-OVFPn-OarUo-OSZCY-wwXsO', 'zywoo'),
    ('s1mple', '2026-05-21', 'CSGO-UseJt-3oTvn-47wPX-hEyER-WZfiK', 's1mple'),
    ('NiKo', '2026-09-04', 'CSGO-vhjbH-yLYcD-bvXQo-aswEA-8P6ZJ', 'niko'),
    ('m0NESY', '2026-09-04', 'CSGO-EvvTA-D6U88-mXTHk-acm3G-bkMHA', 'm0nesy'),
    ('ropz', '2026-09-04', 'CSGO-RLHnF-xbYw5-ZBiB5-MEOKJ-edK5O', 'ropz'),
    ('XANTARES', '2026-09-20', 'CSGO-xbpe2-E24RJ-YXNuO-pQvt8-ppNAK', 'xantares'),
    # Specific Inferno record from August 27, not this player's latest record.
    ('karrigan', '2026-08-27', 'CSGO-Lc7iH-DjpDS-pUNGq-Yvaw7-NM6FP', 'karrigan'),
)


def f32(value: float) -> float:
    return struct.unpack('f', struct.pack('f', value))[0]


def signed_byte(value: int) -> int:
    return value - 256 if value >= 128 else value


def decode_legacy(code: str) -> dict[str, Any]:
    """Decode checked v1 crosshair codes; deliberately reject unknown versions."""
    if not re.fullmatch(r'CSGO(?:-[A-Za-z2-9]{5}){5}', code):
        raise ValueError('Expected CSGO- followed by five groups of five characters.')
    value = 0
    for ch in code[5:].replace('-', '')[::-1]:
        if ch not in ALPHABET:
            raise ValueError(f'Character not in the share-code alphabet: {ch!r}')
        value = value * len(ALPHABET) + ALPHABET.index(ch)
    if value >= (1 << 144):
        raise ValueError('Share code exceeds the 18-byte representation.')
    data = list(value.to_bytes(18, 'big'))
    if data[0] != sum(data[1:]) % 256:
        raise ValueError('Crosshair checksum mismatch.')
    if data[1] != 1:
        raise ValueError(f'Only legacy version 1 is supported, not version {data[1]}.')
    return {
        'code': code, 'version': data[1],
        'size': data[14] / 10, 'thickness': data[12] / 10,
        'gap': signed_byte(data[2]) / 10,
        'dot': bool(data[13] & 16), 'style': (data[13] & 15) >> 1,
        'outline': bool(data[10] & 8), 'outline_width': data[3] / 2,
        'alpha_enabled': bool(data[13] & 64), 'alpha': data[7],
        'color': data[10] & 7, 'rgb': data[4:7],
        'weapon_gap': bool(data[13] & 32), 'recoil': bool(data[8] & 128),
        't_style': bool(data[13] & 128),
        'fixed_gap': signed_byte(data[9]) / 10,
    }


def legacy_geometry(size: float, thickness: float, gap: float, height: int) -> dict[str, Any]:
    """Source-based static geometry, with float32 intermediate arithmetic.

    Includes the CS2KZ near/far longitudinal placement convention. Transverse
    centering, blending, and all dynamic effects remain outside this model.
    """
    if not 240 <= height <= 16384:
        raise ValueError('Height must be between 240 and 16384 game pixels.')
    if not all(math.isfinite(x) for x in (size, thickness, gap)):
        raise ValueError('Geometry inputs must be finite.')
    if not (0 <= size <= 10000 and 0 <= thickness <= 10000 and -10000 <= gap <= 10000):
        raise ValueError('Unsupported input magnitude or negative size/thickness.')
    scale = f32(height / 480)
    length = math.trunc(f32(scale * f32(size)))
    width = max(1, math.trunc(f32(scale * f32(thickness))))
    offset = math.trunc(f32(f32(gap) + f32(4)))
    near = width // 2 + offset
    far = near + 1
    return {
        'height': height,
        'input_size': size, 'input_thickness': thickness, 'input_gap': gap,
        'arm_length_px': length,
        'thickness_px': width,
        'gap_offset_px': offset,
        'near_inner_offset_px': near,
        'far_inner_offset_px': far,
        # Signed separation of opposing arm intervals; not a clear opening
        # when a dot is enabled, the arms overlap, or arm length is zero.
        'opposing_arm_interval_px': 2 * near + 1 if length > 0 else None,
        'dot_side_px_if_enabled': width,
    }


def candidates(geom: dict[str, Any], baseline: float | None = None,
               gap_step: float = 1.0) -> dict[str, Any]:
    """Conditional candidates at authored height == current game height.

    All assume new length/thickness are 1 pixel per unit at that height.
    The two gap candidates additionally assume the same far-side +1 rule.
    A measured baseline is distance of the NEAR arm inner edge at new gap0.
    """
    length, width = geom['arm_length_px'], geom['thickness_px']
    near = geom['near_inner_offset_px']
    vals: dict[str, float] = {
        'same_thickness_relative_baseline': float(geom['gap_offset_px']),
        'zero_center_relative_baseline': float(near),
    }
    if baseline is not None:
        if not math.isfinite(baseline) or not math.isfinite(gap_step) or gap_step <= 0:
            raise ValueError('Measured baseline must be finite and gap step must be positive.')
        vals['measured_baseline'] = (near - baseline) / gap_step
    return {
        'status': 'CONDITIONAL: not validated in the September 23 CS2 client',
        'authored_height': geom['height'],
        'length_candidate': length,
        'thickness_candidate': 0 if geom['input_thickness'] == 0 else width,
        'positive_thickness_same_resolution_alternative': width,
        'zero_thickness_note': 'Literal zero preserves the documented one-pixel-minimum branch; '
                               'positive 1 only matches it at the chosen reference height.',
        'dimension_ranges_ok': 0 <= length <= 255 and 1 <= width <= 31,
        'gap_candidates': {k: {'value': v, 'within_new_range': 0 <= v <= 128}
                           for k, v in vals.items()},
        'warning': 'No silent clamping. Check pixel alignment, outline, and color separately. '
                   'Do not equate a generator\'s normalized 720p values with native convars.',
    }


def audit() -> dict[str, Any]:
    samples = []
    rows = []
    counts = {name: {'length_disagreements': 0, 'thickness_disagreements': 0,
                    'any_dimension_disagreements': 0}
              for name in ('round_scaled', 'fixed_2x', 'hauptrolle_preview')}
    for player, date, code, slug in PROS:
        cfg = decode_legacy(code)
        assert cfg['style'] == 4 and not cfg['weapon_gap'] and not cfg['outline']
        samples.append({'player': player, 'observed_date': date,
                        'source': f'https://www.xhair.pro/en/players/{slug}', **cfg})
        for height in HEIGHTS:
            geom = legacy_geometry(cfg['size'], cfg['thickness'], cfg['gap'], height)
            # Round to nearest, positive ties upward (NOT Python banker's round).
            scale = f32(height / 480)
            rounded = [math.floor(f32(scale * f32(cfg['size'])) + .5),
                       max(1, math.floor(f32(scale * f32(cfg['thickness'])) + .5))]
            fixed = [math.trunc(cfg['size'] * 2), max(1, math.trunc(cfg['thickness'] * 2))]
            haupt = [math.trunc(cfg['size']) * 2 + int(math.trunc(cfg['size']) > 2),
                     cfg['thickness'] * 2]
            expected = [geom['arm_length_px'], geom['thickness_px']]
            models = {'round_scaled': rounded, 'fixed_2x': fixed, 'hauptrolle_preview': haupt}
            for name, pair in models.items():
                mismatches = [pair[i] != expected[i] for i in range(2)]
                counts[name]['length_disagreements'] += int(mismatches[0])
                counts[name]['thickness_disagreements'] += int(mismatches[1])
                counts[name]['any_dimension_disagreements'] += int(any(mismatches))
            rows.append({'player': player, **geom, 'other_model_dimensions': models,
                         'conditional_new_candidates': candidates(geom)})
    return {
        'research_date': '2026-09-23',
        'scope': 'Numerical comparison with a source-based legacy reconstruction; '
                 'not in-game measurements or post-update renderer validation.',
        'sample_count': len(samples), 'height_count': len(HEIGHTS), 'case_count': len(rows),
        'heights': list(HEIGHTS), 'comparison_counts': counts,
        'notes': [
            'Every player preset is tested at every height: these are controlled test '
            'resolutions, not claims of each player\'s actual video settings.',
            'hauptrolle_preview uses fixed display coordinates, not resolution-aware '
            'engine pixels. Its cross-resolution mismatch count is diagnostic only.',
            'Gap is excluded from dimension counters: hauptrolle uses cl_fixedcrosshairgap '
            'rather than cl_crosshairgap, so a direct gap comparison would be misleading.',
            'No best-fit parameters are estimated from actual post-update observations: '
            'none were available in this experiment.'
        ],
        'presets': samples, 'cases': rows,
    }


def self_test() -> int:
    checked = 0
    for _, _, code, _ in PROS:
        assert decode_legacy(code)['version'] == 1
        checked += 1
    known = decode_legacy('CSGO-WsnnD-eHaMw-QNDf9-oxuDh-ydOUD')
    assert (known['size'], known['thickness'], known['gap']) == (10, .6, -2.2)
    checked += 1
    tests = [
        ((1.5, 1, -3, 960), (3, 2, 1)),
        ((2, 0, -3, 2160), (9, 1, 1)),
        ((0, 2, -4, 1080), (0, 4, 0)),
        ((1, 1, -4.5, 1080), (2, 2, 0)),
        ((3, .5, 0, 1080), (6, 1, 4)),
        ((1, 1, -5.1, 1080), (2, 2, -1)),
    ]
    for args, expected in tests:
        got = legacy_geometry(*args)
        assert (got['arm_length_px'], got['thickness_px'], got['gap_offset_px']) == expected
        checked += 1
    for invalid in ('wrong', 'CSGO-OOOOO-OOOOO-OOOOO-OOOOO-OOOOO',
                    'CSGO-aNQn2-upV5w-M8dOd-OOwcf-2pFKA'):
        try:
            decode_legacy(invalid)
        except ValueError:
            checked += 1
        else:
            raise AssertionError('Invalid share code accepted')
    d = audit()
    assert d['case_count'] == 56
    assert all(row['conditional_new_candidates']['dimension_ranges_ok'] for row in d['cases'])
    checked += 2
    zero = candidates(legacy_geometry(2, 0, -3, 1080))
    assert zero['thickness_candidate'] == 0
    assert zero['positive_thickness_same_resolution_alternative'] == 1
    checked += 1
    return checked


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--audit', action='store_true', help='Run all 56 source-based comparisons.')
    p.add_argument('--self-test', action='store_true')
    p.add_argument('--code', help='Legacy v1 crosshair share code.')
    p.add_argument('--size', type=float)
    p.add_argument('--thickness', type=float)
    p.add_argument('--gap', type=float)
    p.add_argument('--height', type=int, default=1080, help='Actual in-game height; default1080.')
    p.add_argument('--new-gap-zero-near-offset', type=float,
                   help='Measured new near-arm inner offset at new gap0 and chosen thickness.')
    p.add_argument('--new-gap-step', type=float, default=1.0,
                   help='Measured pixels moved per new gap unit; default1.')
    p.add_argument('--output', type=Path, help='Write JSON to this file instead of stdout.')
    args = p.parse_args()
    try:
        if args.self_test:
            result: dict[str, Any] = {'checks_passed': self_test(),
                                      'scope': 'Code/data checks only; no CS2 client executed.'}
        elif args.audit:
            result = audit()
        else:
            if args.code and any(v is not None for v in (args.size, args.thickness, args.gap)):
                raise ValueError('Use a share code OR three geometry values, not both.')
            cfg = decode_legacy(args.code) if args.code else None
            if cfg:
                if cfg['style'] != 4 or cfg['weapon_gap']:
                    raise ValueError('This model requires style4 and weapon-dependent gap off.')
                size, thickness, gap = cfg['size'], cfg['thickness'], cfg['gap']
            else:
                if any(v is None for v in (args.size, args.thickness, args.gap)):
                    raise ValueError('Supply --code or all of --size, --thickness, --gap.')
                size, thickness, gap = args.size, args.thickness, args.gap
            geom = legacy_geometry(size, thickness, gap, args.height)
            result = {'legacy_config': cfg, 'legacy_target': geom,
                      'post_update_candidates': candidates(geom,
                          args.new_gap_zero_near_offset, args.new_gap_step)}
        text = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
        if args.output:
            args.output.write_text(text, encoding='utf-8')
        else:
            print(text, end='')
    except (ValueError, OverflowError, OSError) as exc:
        p.error(str(exc))


if __name__ == '__main__':
    main()
