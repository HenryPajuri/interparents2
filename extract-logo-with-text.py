from PIL import Image
import numpy as np

# Load the image
img = Image.open('Front-end/html/images/logo_big.png')
img_array = np.array(img)

# Convert to RGBA if not already
if img.mode != 'RGBA':
    img = img.convert('RGBA')
    img_array = np.array(img)

# Find the logo graphic bounds (non-white pixels)
gray = np.mean(img_array[:, :, :3], axis=2)
non_white_pixels = np.where(gray < 250)

if len(non_white_pixels[0]) > 0:
    # Get bounding box of colored content
    min_y = non_white_pixels[0].min()
    max_y = non_white_pixels[0].max()
    min_x = non_white_pixels[1].min()
    max_x = non_white_pixels[1].max()

    # The graphic + "InterParents" text ends before the subtitle text
    # Typically around 75% of the total height
    graphic_text_max_y = int(max_y * 0.75)  # Adjust to capture graphic + InterParents

    # Crop to include graphic and InterParents text
    cropped = img.crop((min_x, min_y, max_x + 1, graphic_text_max_y))

    # Make white background transparent
    cropped_array = np.array(cropped)

    # Create alpha channel: super aggressive threshold to catch all anti-aliasing
    alpha = np.ones(cropped_array.shape[:2], dtype=np.uint8) * 255

    # Remove all light pixels - super aggressive (down to 150)
    light_pixels = np.all(cropped_array[:, :, :3] > 150, axis=2)
    alpha[light_pixels] = 0

    # Also check for grayish pixels
    grayish = np.mean(cropped_array[:, :, :3], axis=2) > 180
    alpha[grayish] = 0

    # Apply alpha channel
    cropped_array[:, :, 3] = alpha

    # Create new image with transparency
    result = Image.fromarray(cropped_array, 'RGBA')

    # Trim any remaining transparent edges by finding the actual content bounds
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

    # Save the result
    final_img.save('Front-end/html/images/logo_with_text.png')

    print(f'Logo with InterParents text extracted and saved!')
    print(f'Original size: {img.width}x{img.height}')
    print(f'Graphic + text bounds: x({min_x}-{max_x}), y({min_y}-{graphic_text_max_y})')
    print(f'Final size: {final_img.width}x{final_img.height}')
else:
    print('No content found in image')
