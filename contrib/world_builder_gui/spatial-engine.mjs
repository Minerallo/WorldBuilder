const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]
];

export function landmarkDistance(first, second) {
  return Math.hypot(
    Number(first?.x || 0) - Number(second?.x || 0),
    Number(first?.y || 0) - Number(second?.y || 0),
    Number(first?.z || 0) - Number(second?.z || 0)
  );
}

export function handPinchRatio(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 18) return Infinity;
  const palm = Math.max(1e-6, landmarkDistance(landmarks[5], landmarks[17]));
  return landmarkDistance(landmarks[4], landmarks[8]) / palm;
}

export function smoothPoint(previous, next, smoothing = 0.68) {
  if (!previous) return { ...next };
  const retained = clamp(Number(smoothing), 0, .96);
  const incoming = 1 - retained;
  return {
    x: previous.x * retained + next.x * incoming,
    y: previous.y * retained + next.y * incoming,
    z: previous.z * retained + next.z * incoming
  };
}

export function mapLandmarkToViewport(landmark, viewport, options = {}) {
  const margin = clamp(Number(options.margin ?? .06), 0, .3);
  const span = Math.max(.1, 1 - margin * 2);
  const normalizedX = clamp((Number(landmark?.x || 0) - margin) / span, 0, 1);
  const normalizedY = clamp((Number(landmark?.y || 0) - margin) / span, 0, 1);
  return {
    x: (options.mirror === false ? normalizedX : 1 - normalizedX) * viewport.width,
    y: normalizedY * viewport.height,
    z: Number(landmark?.z || 0)
  };
}

export function twoHandTransform(previous, current) {
  if (!previous?.left || !previous?.right || !current?.left || !current?.right) return null;
  const vector = pair => ({ x:pair.right.x-pair.left.x, y:pair.right.y-pair.left.y });
  const oldVector = vector(previous); const newVector = vector(current);
  const oldDistance = Math.max(1e-6, Math.hypot(oldVector.x,oldVector.y));
  const newDistance = Math.max(1e-6, Math.hypot(newVector.x,newVector.y));
  const oldAngle = Math.atan2(oldVector.y,oldVector.x);
  const newAngle = Math.atan2(newVector.y,newVector.x);
  let rotation = (newAngle-oldAngle)*180/Math.PI;
  if (rotation > 180) rotation -= 360;
  if (rotation < -180) rotation += 360;
  return {
    scale:newDistance/oldDistance,
    rotation,
    panX:((current.left.x+current.right.x)-(previous.left.x+previous.right.x))/2,
    panY:((current.left.y+current.right.y)-(previous.left.y+previous.right.y))/2
  };
}

export class SpatialGestureTracker {
  constructor(options = {}) {
    this.options = { smoothing:.68,pinchThreshold:.34,releaseThreshold:.46,mirror:true,...options };
    this.hands = new Map();
    this.previousPair = null;
  }

  configure(options = {}) { Object.assign(this.options,options); }

  reset() { this.hands.clear(); this.previousPair=null; }

  update(rawHands, viewport) {
    const observed = new Set();
    const hands = (rawHands || []).map((raw,index) => {
      const key = raw.handedness || String(index);
      observed.add(key);
      const prior = this.hands.get(key);
      const pointer = smoothPoint(prior?.pointer,mapLandmarkToViewport(raw.landmarks?.[8],viewport,this.options),this.options.smoothing);
      const pinchRatio = handPinchRatio(raw.landmarks);
      const pinching = prior?.pinching
        ? pinchRatio < Number(this.options.releaseThreshold)
        : pinchRatio < Number(this.options.pinchThreshold);
      const hand = {
        ...raw,key,pointer,pinchRatio,pinching,
        pinchStart:pinching && !prior?.pinching,
        pinchEnd:!pinching && Boolean(prior?.pinching)
      };
      this.hands.set(key,hand);
      return hand;
    });
    [...this.hands.keys()].forEach(key => { if (!observed.has(key)) this.hands.delete(key); });
    const primary = hands.find(hand => hand.handedness === this.options.dominantHand) || hands[0] || null;
    const pinched = hands.filter(hand => hand.pinching).sort((first,second) => {
      const rank = hand => hand.handedness === "Left" ? 0 : hand.handedness === "Right" ? 1 : 2;
      return rank(first)-rank(second) || first.pointer.x-second.pointer.x;
    });
    const pair = pinched.length >= 2 ? { left:pinched[0].pointer,right:pinched[1].pointer } : null;
    const transform = pair && this.previousPair ? twoHandTransform(this.previousPair,pair) : null;
    this.previousPair = pair;
    return { hands,primary,transform,twoHand:Boolean(pair) };
  }
}
