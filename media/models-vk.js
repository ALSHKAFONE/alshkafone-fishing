function unpackVKModel(compressed) {
  const bytes = pako.inflate(new Uint8Array(compressed));
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
  const spans = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + headerLength)));
  const glb = bytes.slice(4 + headerLength);
  for (const [start, length, stride, mode] of spans) {
    const source = glb.slice(start, start + length);
    const rows = length / stride;
    for (let column = 0; column < stride; column++) {
      let previous = 0;
      for (let row = 0; row < rows; row++) {
        const stored = source[column * rows + row];
        const value = mode === 2 ? (stored + previous) & 255 : stored;
        glb[start + row * stride + column] = value;
        previous = value;
      }
    }
  }
  return glb.buffer;
}
function loadVKModel(url, loader, ready, progress, failed) {
  if (!url.endsWith('.bin')) return loader.load(url, ready, progress, failed);
  fetch(url).then(response => {
    if (!response.ok) throw Error('Не удалось загрузить 3D-модель');
    return response.arrayBuffer();
  }).then(unpackVKModel).then(buffer => loader.parse(buffer, '', ready, failed)).catch(failed);
}
