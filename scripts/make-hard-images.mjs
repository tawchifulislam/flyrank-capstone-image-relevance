import sharp from "sharp";
import path from "node:path";

const dir = path.resolve("corpus");
const src = (n) => path.join(dir, `img_${String(n).padStart(3, "0")}.jpg`);
const out = (n) => path.join(dir, `img_${String(n).padStart(3, "0")}.jpg`);

async function pixelate(from, to) {
  const meta = await sharp(from).metadata();
  const small = await sharp(from).resize({ width: 18 }).toBuffer();
  await sharp(small)
    .resize({ width: meta.width, kernel: "nearest" })
    .blur(6)
    .jpeg({ quality: 70 })
    .toFile(to);
}

async function darkCrop(from, to) {
  const meta = await sharp(from).metadata();
  const size = Math.floor(Math.min(meta.width, meta.height) * 0.18);
  const left = Math.floor((meta.width - size) / 2);
  const top = Math.floor((meta.height - size) / 2);
  await sharp(from)
    .extract({ left, top, width: size, height: size })
    .resize(512, 512, { kernel: "nearest" })
    .modulate({ brightness: 0.35 })
    .blur(3)
    .jpeg({ quality: 70 })
    .toFile(to);
}

async function heavyBlur(from, to) {
  await sharp(from)
    .resize({ width: 640 })
    .modulate({ brightness: 0.5 })
    .blur(30)
    .jpeg({ quality: 70 })
    .toFile(to);
}

await pixelate(src(25), out(51));
await darkCrop(src(5), out(52));
await heavyBlur(src(14), out(53));
await darkCrop(src(36), out(54));
console.log("created img_051.jpg to img_054.jpg");
