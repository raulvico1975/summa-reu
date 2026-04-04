export const BLOCK_VIDEO_PRESETS = {
  premium4k: {
    label: 'Bloc funcional premium 4K',
    captureViewport: {
      width: 2048,
      height: 1152,
    },
    exportDimensions: {
      width: 3840,
      height: 2160,
    },
    fps: 30,
    masterBitrate: '18M',
    maxRate: '24M',
    bufferSize: '36M',
    scaleFilter: 'lanczos',
    framing: 'open',
    cssZoomAllowed: false,
    notes: [
      "La UI s'ha de gravar amb mida realista d'app, no amb una viewport 4K que la faci petita.",
      'La sortida final pot escalar a 4K, pero la captura base ha de ser llegible per a un client potencial.',
      'Els blocs de funcionalitats s han d entregar en 4K/30 premium.',
    ],
  },
};

export function getBlockVideoPreset(name = 'premium4k') {
  const preset = BLOCK_VIDEO_PRESETS[name];
  if (!preset) {
    throw new Error(`Preset de bloc no suportat: ${name}`);
  }

  return preset;
}
