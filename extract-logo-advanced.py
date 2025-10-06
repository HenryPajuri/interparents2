from PIL import Image
import numpy as np
from scipy import ndimage

# Load the image
img = Image.open('Front-end/html/images/logo_big.png')
img = img.convert('RGBA')
img_array = np.array(img)

# Extract RGB and create a mask based on color distance from white
rgb = img_array[:, :, :3].astype(float)

# Calculate color distance from pure white (255, 255, 255)
white = np.array([255, 255, 255])
color_distance = np.sqrt(np.sum((rgb - white)**2, axis=2))

# Create mask: pixels far enough from white are kept
# Use a threshold - higher = more aggressive
threshold = 50  # Adjust this value (20-100)
mask = color_distance > threshold

# Apply morphological operations to clean up the mask
# Remove small noise
mask = ndimage.binary_opening(mask, structure=np.ones((3,3)))
# Fill small holes
mask = ndimage.binary_closing(mask, structure=np.ones((3,3)))

# Find bounding box of non-transparent content
rows = np.any(mask, axis=1)
cols = np.any(mask, axis=0)
ymin, ymax = np.where(rows)[0][[0, -1]]
xmin, xmax = np.where(cols)[0][[0, -1]]

print(f"Content bounds: x({xmin}-{xmax}), y({ymin}-{ymax})")

# Determine crop region based on content
# For graphic only: crop at ~60% of height
# For graphic + text: crop at ~75% of height
graphic_only_y = int(ymin + (ymax - ymin) * 0.60)
graphic_text_y = int(ymin + (ymax - ymin) * 0.75)

# Create both versions
for crop_name, crop_y, output_name in [
    ('Graphic only', graphic_only_y, 'logo_graphic_v2.png'),
    ('Graphic + Text', graphic_text_y, 'logo_with_text_v2.png')
]:
    # Crop the image and mask
    cropped_img = img_array[ymin:crop_y+1, xmin:xmax+1].copy()
    cropped_mask = mask[ymin:crop_y+1, xmin:xmax+1]

    # Create alpha channel from mask
    alpha = (cropped_mask * 255).astype(np.uint8)

    # Apply gradient transparency near edges to smooth anti-aliasing
    # This creates a soft edge instead of hard cutoff
    distance_from_edge = ndimage.distance_transform_edt(cropped_mask)
    edge_smoothing = np.clip(distance_from_edge / 2.0, 0, 1)  # 2 pixel gradient
    alpha = (alpha * edge_smoothing).astype(np.uint8)

    # Apply alpha to image
    cropped_img[:, :, 3] = alpha

    # Create final image
    result = Image.fromarray(cropped_img, 'RGBA')

    # Trim to actual content bounds (remove fully transparent rows/cols)
    result_array = np.array(result)
    non_transparent = np.where(result_array[:, :, 3] > 0)

    if len(non_transparent[0]) > 0:
        trim_top = non_transparent[0].min()
        trim_bottom = non_transparent[0].max() + 1
        trim_left = non_transparent[1].min()
        trim_right = non_transparent[1].max() + 1

        final_img = result.crop((trim_left, trim_top, trim_right, trim_bottom))
    else:
        final_img = result

    # Save
    final_img.save(f'Front-end/html/images/{output_name}')
    print(f'{crop_name}: {final_img.width}x{final_img.height} -> {output_name}')

print('\nDone! Created logo_graphic_v2.png and logo_with_text_v2.png')
print('These use edge detection and gradient smoothing for cleaner edges.')
