export const ColorPalettes = {
  default: {
    chargePositive: 0xff3b30, // red
    chargeNegative: 0x2979ff, // blue
    fieldVector: 0xffffff,
    velocityVector: 0xffffff,
    magneticForceVector: 0x8e44ad, // deep violet
  },
  protanopia: {
    chargePositive: 0xffc107,     // amber (distinguishable from teal)
    chargeNegative: 0x00acc1,     // cyan-teal
    fieldVector: 0xf5f5f5,
    velocityVector: 0xf5f5f5,
    magneticForceVector: 0x7f8c8d, // neutral gray
  },
  deuteranopia: {
    chargePositive: 0xffb300,     // warm yellow-orange
    chargeNegative: 0x03a9f4,     // light cyan-blue
    fieldVector: 0xf0f0f0,
    velocityVector: 0xf0f0f0,
    magneticForceVector: 0x9e9e9e, // soft gray
  },
  tritanopia: {
    chargePositive: 0xff7043,     // bright coral-orange
    chargeNegative: 0x4fc3f7,     // sky blue
    fieldVector: 0xfafafa,
    velocityVector: 0xfafafa,
    magneticForceVector: 0xb0bec5, // blue-gray
  },
}
