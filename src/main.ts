import './style.css';
import { App } from './app/App';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Elemen #app tidak ditemukan');
}

const app = new App(container);
app.start();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker gagal didaftarkan', error);
    });
  });
}
