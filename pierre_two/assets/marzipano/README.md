# Marzipano Assets

This directory contains assets for the Marzipano 360° viewer.

## Files

- `viewer.html` - The Marzipano 360° viewer implementation
- `placeholder-nightclub.jpg` - **TO BE ADDED** - Placeholder 360° image

## Adding the Placeholder Image

You need to add a 360° equirectangular placeholder image for testing.

### Quick Option: Use a Free Stock Image

Visit one of these sites and download a nightclub/bar 360° image:

1. **Freepik**: https://www.freepik.com/free-photos-vectors/equirectangular-360
2. **Pixabay**: https://pixabay.com/images/search/360%20panorama/
3. **Pexels**: https://www.pexels.com/search/360/

### Requirements

- **Format**: JPEG
- **Resolution**: 4096×2048 pixels (2:1 ratio)
- **Size**: < 2MB
- **Projection**: Equirectangular

### Save As

`/Users/root-kawaii/Desktop/PR/pierre_two/assets/marzipano/placeholder-nightclub.jpg`

### Alternative: Generate with AI

If you can't find a suitable free image, you can generate one using:
- **DALL-E**: "360 degree equirectangular panorama of a modern nightclub interior"
- **Midjourney**: "360 panorama nightclub interior, equirectangular projection"
- **Stable Diffusion**: Use 360° panorama models

## For Production Use

**Don't use the placeholder in production!**

Follow the [Marzipano Integration Guide](../../../docs/MARZIPANO_INTEGRATION_GUIDE.md) to:
1. Capture real 360° photos of your venues
2. Optimize and upload to a CDN
3. Configure the database with real image URLs

The placeholder is only for development and testing.
