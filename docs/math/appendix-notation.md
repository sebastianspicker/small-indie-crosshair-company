# Appendix A. Notation

Each symbol is defined once here and used with this meaning in every chapter.
Unprimed symbols describe the old crosshair, primed symbols the current game's
drawing, and starred symbols the target the inverse aims for. Pixel coordinates
are integers on the game image, relative to the centre pixel; intervals are
half-open, so $[x, x+n)$ covers $n$ cells.

## Heights and ratios

| Symbol | Meaning |
|---|---|
| $H_{\mathrm{old}}$ | Game height (in-game resolution, not the monitor's) of the old crosshair |
| $H_{\mathrm{cur}}$ | Game height the converted crosshair is shown at |
| $H_{\mathrm{auth}}$ | Authored height, `cl_crosshair_screen_height`: the height the new values are written for |
| $r$ | Authored ratio $H_{\mathrm{cur}}/H_{\mathrm{auth}}$ |
| $q$ | Screen ratio $H_{\mathrm{cur}}/H_{\mathrm{old}}$, used by the screen goal |
| $s$ | Old height scale $\operatorname{f32}(H_{\mathrm{old}}/480)$ |

## Old settings and old pixels

| Symbol | Meaning |
|---|---|
| $S$, $T$, $G$ | Old `cl_crosshairsize`, `cl_crosshairthickness`, `cl_crosshairgap` |
| $u$ | Old `cl_crosshair_outlinethickness` (at most 3) |
| $\tau$ | T flag, `cl_crosshair_t` (1: the top arm is omitted) |
| $L$ | Drawn arm length in pixels |
| $W$ | Drawn bar width (and dot side) in pixels |
| $d$ | Gap offset: $\operatorname{trunc}(G+4)$, or the style 5 rule |
| $a$ | Near edge: the left arm ends at $-a$, the top arm at $-a$ |
| $b$ | Far drawing edge: the right and bottom arms start at $b$ |
| $b_{\mathrm f}$ | Far formula offset $a+1$ of the historical models |
| $t$ | Axis start: a horizontal bar covers rows $[t, t+W)$ |
| $o_{\mathrm{lo}}$, $o_{\mathrm{hi}}$ | Outline extent: pixels the outline adds left/top and right/bottom |
| $e_{\uparrow}$, $e_{\downarrow}$ | How far the old T stem reached above and below the horizontal bar |

## New values and new pixels

| Symbol | Meaning |
|---|---|
| $\ell$, $\theta$, $g$ | New `cl_crosshair_length`, `cl_crosshair_thickness`, `cl_crosshair_gap` (integers) |
| $v$ | A native tuple $(\ell, \theta, g, H_{\mathrm{auth}})$ |
| $P_r(x)$ | Drawn pixels of a native value $x$ at ratio $r$: 0 for $x=0$, else $\max(1, \operatorname{round}(xr))$ |
| $L'$, $W'$, $a'$, $b'$, $t'$ | Drawn length, width, near edge, far edge and axis start of the export |
| $L^{*}$, $W^{*}$, $a^{*}$, $b^{*}$ | Target dimensions and edges |
| $\mathcal V$ | Legal native domain: $\ell \in 0..255$, $\theta \in 0..32$ (0..31 before build 2000922), $g \in 0..128$ |

## Arithmetic and scores

| Symbol | Meaning |
|---|---|
| $\operatorname{f32}(x)$ | $x$ rounded to binary32 (`Math.fround`) |
| $\operatorname{trunc}$, $\operatorname{roundEven}$ | Rounding toward zero; rounding to nearest with ties to even |
| $Q$ | A quantizer of the historical models: truncation, nearest (ties up) or ceiling |
| $\operatorname{IoU}(A,B)$ | $\lvert A\cap B\rvert/\lvert A\cup B\rvert$ of two pixel sets |
| $\operatorname{IoU}_{\pm1}$ | Aligned overlap: the best IoU over whole-shape shifts $dx, dy \in \{-1,0,1\}$ |

## The historical 27-model study

| Symbol | Meaning |
|---|---|
| $m$, $R_m$ | A renderer hypothesis and its forward function |
| $\pi_m$, $w_m$ | Prior and posterior weight of hypothesis $m$ |
| $B$, $K$ | Intercept and slope of a measured affine gap fit $a' = B + Kg$ |
