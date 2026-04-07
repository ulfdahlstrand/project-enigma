async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load selected image"));
    image.src = dataUrl;
  });
}

export async function prepareProfileImages(
  file: File,
  size = 512
): Promise<{ originalDataUrl: string; displayDataUrl: string }> {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is unavailable");
  }

  const side = Math.min(image.width, image.height);
  const sx = (image.width - side) / 2;
  const sy = (image.height - side) / 2;

  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  context.closePath();
  context.clip();
  context.drawImage(image, sx, sy, side, side, 0, 0, size, size);

  return {
    originalDataUrl,
    displayDataUrl: canvas.toDataURL("image/png"),
  };
}
