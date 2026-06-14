// 세움 홈플래너 - 진입점
import { store } from './store.js';
import { Editor2D } from './editor2d.js';
import { Viewer3D } from './viewer3d.js';
import { buildUI } from './ui.js';

const editor = new Editor2D(document.getElementById('canvas2d'));
const viewer = new Viewer3D(document.getElementById('view3d'));

let mode = '2d';
function setMode(m) {
  mode = m;
  document.getElementById('stage-2d').classList.toggle('hidden', m !== '2d');
  document.getElementById('stage-3d').classList.toggle('hidden', m !== '3d');
  document.getElementById('tb-2d').classList.toggle('active', m === '2d');
  document.getElementById('tb-3d').classList.toggle('active', m === '3d');
  document.getElementById('view-presets').classList.toggle('hidden', m !== '3d');
  viewer.setActive(m === '3d');
  if (m === '2d') { editor._resize(); editor.draw(); }
}

buildUI({ editor, viewer, onModeChange: setMode });
setMode('2d');

// 전역 디버그용
window.SEUM = { store, editor, viewer };
