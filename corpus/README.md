# Corpus

About 50 images across 5 categories: fox, wolf, dog, deer, bear.

Sources: Unsplash and Pexels.
Licenses: Unsplash License and Pexels License, both free to use, no attribution required.

File names are neutral (img_001.jpg and so on) on purpose, so the system must understand the image content and not rely on file names.

## Degraded images

img_051.jpg to img_054.jpg are deliberately degraded copies made from other corpus images by scripts/make-hard-images.mjs (pixelated, a dark zoomed crop, and a heavy blur). They exist to produce genuinely ambiguous inputs so that low-confidence tagging and flagging can be demonstrated. They are not real photographs and are not used as correct answers in the eval set.
