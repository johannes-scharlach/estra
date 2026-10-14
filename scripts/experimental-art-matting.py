# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["rembg[cpu]==2.0.85"]
# ///
"""Opt-in artwork experiment: RGB PNG on stdin, foreground RGBA PNG on stdout."""

import argparse
import io
import sys

from PIL import Image
from rembg import new_session, remove
from rembg.bg import alpha_matting_cutout, decontaminate_cutout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mask", help="Known alpha mask: white opaque, black transparent, grey partial coverage")
    args = parser.parse_args()
    image = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB")

    if args.mask:
        mask = Image.open(args.mask).convert("L")
        if mask.size != image.size:
            raise ValueError("Mask dimensions must match the oriented source image.")
        # An authored mask already supplies coverage. Do not estimate alpha a
        # second time; only recover the uncontaminated foreground colours.
        cutout = decontaminate_cutout(image, mask)
    else:
        # Explicit model: do not inherit rembg's default model or its licence.
        mask = remove(image, session=new_session("isnet-general-use"), only_mask=True)
        # Refine model coverage AND estimate foreground colours. Fail rather
        # than silently falling back to pasting contaminated RGB through a mask.
        cutout = alpha_matting_cutout(image, mask, 240, 10, 3)
    cutout.save(sys.stdout.buffer, format="PNG")


if __name__ == "__main__":
    main()
