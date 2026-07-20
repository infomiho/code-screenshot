import { JPG } from 'image-size/types/jpg'
import { PNG } from 'image-size/types/png'

const maxRasterBytes = 48 * 1024
const maxRasterDimension = 2048
const maxRasterPixels = 4_000_000

export type RasterDataUrlValidation = {
  allowed: boolean
  message: string
}

export const validateRasterDataUrl = (value: string): RasterDataUrlValidation => {
  const match = value.match(/^data:image\/(png|jpeg);base64,([a-z0-9+/]+={0,2})$/i)
  const invalid = { allowed: false, message: 'URL must be a base64 PNG or JPEG data URL.' }
  if (!match || match[2].length % 4 !== 0) return invalid

  let bytes: Uint8Array
  try {
    const binary = globalThis.atob(match[2])
    if (binary.length > maxRasterBytes) {
      return {
        allowed: false,
        message: `Decoded raster is ${binary.length} bytes; maximum is ${maxRasterBytes} bytes.`,
      }
    }
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return invalid
  }

  try {
    const isPng = match[1].toLowerCase() === 'png'
    const hasTerminator = isPng
      ? String.fromCharCode(...bytes.slice(-8, -4)) === 'IEND'
      : bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9
    if (!hasTerminator) return invalid
    const image = isPng ? PNG : JPG
    if (!image.validate(bytes)) return invalid
    const dimensions = image.calculate(bytes)
    if (!dimensions.width || !dimensions.height) return invalid
    if (dimensions.width > maxRasterDimension || dimensions.height > maxRasterDimension) {
      return {
        allowed: false,
        message: `Raster dimensions are ${dimensions.width}x${dimensions.height}px; maximum is ${maxRasterDimension}px per dimension.`,
      }
    }
    const pixels = dimensions.width * dimensions.height
    if (pixels > maxRasterPixels) {
      return {
        allowed: false,
        message: `Raster contains ${pixels} pixels; maximum is ${maxRasterPixels} pixels.`,
      }
    }
    return { allowed: true, message: '' }
  } catch {
    return invalid
  }
}

export const isAllowedRasterDataUrl = (value: string) => validateRasterDataUrl(value).allowed
