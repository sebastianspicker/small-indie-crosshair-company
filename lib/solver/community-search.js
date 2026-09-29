/** Finite dimension-first search. Pixel overlap selects among equally accurate size choices. */
import { communityDimension, communityForward } from '../geometry/community.js';
import { drawingEdges } from '../geometry/raster.js';
import { communityAxis } from './community-axis.js';
import { visualContext } from './visual.js';

function representatives(solution, ratio) {
  const values = new Map();
  for (const value of [...solution.equivalents].sort((a, b) =>
    Math.abs(a - solution.ideal) - Math.abs(b - solution.ideal) || a - b)) {
    const drawn = communityDimension(value, ratio);
    if (!values.has(drawn)) values.set(drawn, value);
  }
  return [...values.values()];
}

export function searchCommunity(target, settings, options, targetMask = null) {
  const ratio = options.currentHeight / options.authoredHeight, edges = drawingEdges(target);
  let axisEvaluations = 0;
  const axis = (wanted, max, minimum = 0) => {
    const { evaluations, ...solution } = communityAxis(wanted, ratio, max, minimum);
    axisEvaluations += evaluations;
    return solution;
  };
  const length = axis(target.length, 255), thickness = axis(target.width, 31, 1);
  const lengths = representatives(length, ratio), widths = representatives(thickness, ratio);
  const visual = visualContext(target, settings, targetMask), branches = [];
  for (const value of widths) {
    const width = communityDimension(value, ratio), radius = (edges.near + edges.far + width % 2) / 2;
    const gap = axis(radius, 128);
    branches.push({ thickness: value, gap, radius, gaps: representatives(gap, ratio) });
  }
  const originalBranch = branches.find(branch => branch.thickness === thickness.value);
  const initial = { length: length.value, thickness: thickness.value, gap: originalBranch.gap.value,
    authoredHeight: options.authoredHeight };
  const beforeIou = visual.score(communityForward(initial, options.currentHeight)).iou ?? 0;
  let best = null;
  const shapes = [];
  for (const branch of branches) for (const l of lengths) for (const g of branch.gaps) {
    const native = { length: l, thickness: branch.thickness, gap: g, authoredHeight: options.authoredHeight };
    const predicted = communityForward(native, options.currentHeight), iou = visual.score(predicted).iou ?? 0;
    const edgeLoss = (predicted.near - edges.near) ** 2 + (predicted.far - edges.far) ** 2;
    const preference = [Math.abs(l - length.ideal), l, Math.abs(branch.thickness - thickness.ideal),
      branch.thickness, Math.abs(g - branch.gap.ideal), g];
    const candidate = { native, predicted, iou, edgeLoss, preference, branch };
    const prefer = best ? preference.findIndex((value, i) => value !== best.preference[i]) : -1;
    // Preserve the previous length/width/gap preference unless pixels actually improve.
    if (!best || iou > best.iou || (iou === best.iou &&
      prefer >= 0 && preference[prefer] < best.preference[prefer]))
      best = candidate;
    shapes.push({ native, iou, edgeLoss });
  }
  const selected = (solution, value) => ({ ...solution, value, tie: Math.abs(value - solution.ideal) });
  return { native: best.native, predicted: best.predicted, radius: best.branch.radius,
    solutions: { length: selected(length, best.native.length), thickness: selected(thickness, best.native.thickness),
      gap: selected(best.branch.gap, best.native.gap) },
    axisEvaluations,
    tieBreak: { baseline: 'closest-ideal-initialization',
      evaluated: shapes.length, improved: best.iou > beforeIou, beforeIou, afterIou: best.iou,
      lengthBranches: lengths.length, widthBranches: widths.length, alternatives: shapes,
      scope: 'Minimum length/width error; closest radius for each tied width; exact overlap selects the final shape. ' +
        'Not a global pixel optimum over arbitrary dimensions or gaps.' } };
}
