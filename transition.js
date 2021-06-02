const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage, Image } = require("canvas");
const sizeOf = require("image-size");

let frame;

/*************************************************************************************/
const hmin = 55;
const hmax = 210; // hue -> 초록색 범위를 70~170으로 잡음. 조정가능
const smin = 20; // saturation -> s가 낮으면 흰색임. 흰색을 지우지 않기 위해 하한 설정
const vmin = 40; // value -> v가 낮으면 검정색. 검정색을 지우지 않기 위해 하한 설정
/*************************************************************************************/
const folder = path.join(__dirname, "folder");
const files = fs.readdirSync(folder);
for (let file of files) {
  //그냥 사진 불러오는 부분
  if (file.split(".").slice(-1)[0] !== "png" && file.split(".").slice(-1)[0] !== "jpg") {
    continue;
  }
  let imgPath = path.join(folder, file);
  console.log(imgPath);
  const { width, height } = sizeOf(imgPath);
  console.log(width, height);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const ctx2 = canvas.getContext("2d");
  loadImage(imgPath).then((image) => {
    ctx.drawImage(image, 0, 0, width, height);
    frame = ctx.getImageData(0, 0, width, height);

    /* 크로마키 제거하는 부분 */
    let p = [];
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        p = pixel(width * r + c);
        let { h, s, v } = rgb2hsv(...p);
        mooyaho(r, c, width, h, s, v);
      }
    }
    /* 크로마키 제거하는 부분 */

    //그냥 이미지 저장하는 부분
    ctx2.putImageData(frame, 0, 0);
    canvas.toBuffer((err, buf) => {
      let _2 = imgPath.split("/").slice(-1)[0];
      let _1 = path.join(folder, "chromakey");
      let target = path.join(_1, _2);
      console.log(target);
      fs.writeFileSync(target, buf);
    });
  });
}

function mooyaho(r, c, w, h, s, v) {
  if (skirtGreen(h, s, v)) {
    s = Math.max(s - 15, 5);
    const { r: newR, g: newG, b: newB } = hsv2rgb(h, s, v);
    frame.data[4 * w * r + 4 * c] = newR;
    frame.data[4 * w * r + 4 * c + 1] = newG;
    frame.data[4 * w * r + 4 * c + 2] = newB;
    // frame.data[4 * w * r + 4 * c + 3] = 200;
    return;
  }
  if (clothGreen(h, s, v)) {
    //옷에 비친 초록색을 빼자
    if (v < 30) {
      h = 205;
      //그림자
      v -= 5;
      s -= 5;
      const { r: newR, g: newG, b: newB } = hsv2rgb(h, s, v);
      frame.data[4 * w * r + 4 * c] = newR;
      frame.data[4 * w * r + 4 * c + 1] = newG;
      frame.data[4 * w * r + 4 * c + 2] = newB;
    } else if (s > 68 && h < 160) {
      //아예초록색
      frame.data[4 * w * r + 4 * c + 3] = 0;
    } else {
      frame.data[4 * w * r + 4 * c + 3] = Math.min(Math.pow(h - 160, 2) * 0.16, 255);
    }

    return;
  }
  if (isHairGreen(h, s, v)) {
    //머릿쪽 초록색 힘을 약화시키자
    s = Math.max(40, s - 30);
    h = Math.min(60, h - 20);
    v -= 2;
    if (v > 20) {
      frame.data[4 * w * r + 4 * c + 3] = 180;
      v = Math.max(17, v - 20);
    }
    const { r: newR, g: newG, b: newB } = hsv2rgb(h, s, v);
    frame.data[4 * w * r + 4 * c] = newR;
    frame.data[4 * w * r + 4 * c + 1] = newG;
    frame.data[4 * w * r + 4 * c + 2] = newB;
    return;
  }
  if (flashGreen(h, s, v)) {
    //살에 비친 초록색을 없애자
    h = Math.max(-h + 35, 0);
    s -= 2;
    const { r: newR, g: newG, b: newB } = hsv2rgb(h, s, v);
    frame.data[4 * w * r + 4 * c] = newR;
    frame.data[4 * w * r + 4 * c + 1] = newG;
    frame.data[4 * w * r + 4 * c + 2] = newB;
    blur(r, c, w);
    return;
  }
  if (!isGreen(h, s, v)) {
    //초록색이 아닌건 냅두자
    return;
  }
  if (s > 65 && h < 170) {
    //생초록색은 투명하게
    return (frame.data[4 * w * r + 4 * c + 3] = 0);
  }
  if (h <= 150) {
    //살색 테두리
    frame.data[4 * w * r + 4 * c + 3] = Math.min(255, (5 / 8) * Math.pow(s - 65, 2));
    h = Math.max(h - 60, 40);
    v += 3;
    s -= 10;
    const { r: newR, g: newG, b: newB } = hsv2rgb(h, s, v);
    frame.data[4 * w * r + 4 * c] = newR;
    frame.data[4 * w * r + 4 * c + 1] = newG;
    frame.data[4 * w * r + 4 * c + 2] = newB;
  }
}

function blur(r, c, w) {
  let _pixel = [0, 0, 0, 0];
  let count = 0;
  for (let i = -1; i < 2; i++) {
    for (let j = -1; j < 2; j++) {
      let p = pixel(w * (r + i) + (c + j));
      let { h, s, v } = rgb2hsv(...p);
      if (isGreen(h, s, v)) {
        continue;
      }
      count++;
      _pixel[0] += p[0];
      _pixel[1] += p[1];
      _pixel[2] += p[2];
      _pixel[3] += p[3];
    }
  }
  _pixel[0] /= count;
  _pixel[1] /= count;
  _pixel[2] /= count;
  _pixel[3] /= count;
  frame.data[4 * w * r + 4 * c] = _pixel[0];
  frame.data[4 * w * r + 4 * c + 1] = _pixel[1];
  frame.data[4 * w * r + 4 * c + 2] = _pixel[2];
  frame.data[4 * w * r + 4 * c + 3] = _pixel[3];
}

function isGreen(h, s, v) {
  //생초록색
  return hmin <= h && h <= hmax && smin <= s && vmin <= v;
}
function isHairGreen(h, s, v) {
  //머리쪽 초록색
  return hmin <= h && h <= 160 && smin <= s && v < vmin;
}
function flashGreen(h, s, v) {
  //살색쪽 초록색
  return 35 < h && h < hmin && smin <= s && vmin <= v;
}
function clothGreen(h, s, v) {
  //옷에 비친 초록색
  return 150 < h && h < 200 && smin <= s && 20 <= v;
}
function skirtGreen(h, s, v) {
  //하얀치마 색을 빼자
  return 60 < h && h < 160 && s < 40 && v > 70;
}

function pixel(n) {
  //r,g,b,a 반환
  return frame.data.slice(4 * n, 4 * n + 4);
}

function rgb2hsv(r, g, b) {
  let rabs, gabs, babs, rr, gg, bb, h, s, v, diff, diffc, percentRoundFn;
  rabs = r / 255;
  gabs = g / 255;
  babs = b / 255;
  (v = Math.max(rabs, gabs, babs)), (diff = v - Math.min(rabs, gabs, babs));
  diffc = (c) => (v - c) / 6 / diff + 1 / 2;
  percentRoundFn = (num) => Math.round(num * 100) / 100;
  if (diff == 0) {
    h = s = 0;
  } else {
    s = diff / v;
    rr = diffc(rabs);
    gg = diffc(gabs);
    bb = diffc(babs);

    if (rabs === v) {
      h = bb - gg;
    } else if (gabs === v) {
      h = 1 / 3 + rr - bb;
    } else if (babs === v) {
      h = 2 / 3 + gg - rr;
    }
    if (h < 0) {
      h += 1;
    } else if (h > 1) {
      h -= 1;
    }
  }
  return {
    h: Math.round(h * 360),
    s: percentRoundFn(s * 100),
    v: percentRoundFn(v * 100),
  };
}

function mix(a, b, v) {
  return (1 - v) * a + v * b;
}

function hsv2rgb(H, S, V) {
  S = S / 100;
  V = V / 100;
  let V2 = V * (1 - S);
  let r =
    (H >= 0 && H <= 60) || (H >= 300 && H <= 360)
      ? V
      : H >= 120 && H <= 240
      ? V2
      : H >= 60 && H <= 120
      ? mix(V, V2, (H - 60) / 60)
      : H >= 240 && H <= 300
      ? mix(V2, V, (H - 240) / 60)
      : 0;
  let g =
    H >= 60 && H <= 180
      ? V
      : H >= 240 && H <= 360
      ? V2
      : H >= 0 && H <= 60
      ? mix(V2, V, H / 60)
      : H >= 180 && H <= 240
      ? mix(V, V2, (H - 180) / 60)
      : 0;
  let b =
    H >= 0 && H <= 120
      ? V2
      : H >= 180 && H <= 300
      ? V
      : H >= 120 && H <= 180
      ? mix(V2, V, (H - 120) / 60)
      : H >= 300 && H <= 360
      ? mix(V, V2, (H - 300) / 60)
      : 0;

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}
