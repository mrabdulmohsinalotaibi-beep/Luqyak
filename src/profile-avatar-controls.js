import { openAvatarCropper } from './profile-avatar-editor.js';

/**
 * Mount avatar controls in an existing account page.
 * The server authenticates /api/social/avatar; never send an account id.
 * @param {HTMLElement} container
 * @param {{onSaved?: () => Promise<void>|void, onError?: (message:string)=>void}} options
 */
export function mountAvatarControls(container, options = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('Avatar container required');
  const wrap = document.createElement('div');
  wrap.className = 'lk-avatar-controls';
  wrap.dir = 'rtl';
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:12px 0';
  const camera = document.createElement('input');
  camera.type = 'file';
  camera.accept = 'image/*';
  camera.setAttribute('capture', 'user');
  camera.hidden = true;
  const gallery = document.createElement('input');
  gallery.type = 'file';
  gallery.accept = 'image/*';
  gallery.hidden = true;
  const makeButton = (label, input) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.className = 'lk-avatar-edit';
    button.addEventListener('click', () => input.click());
    return button;
  };
  const cameraButton = makeButton('📷 تصوير الآن', camera);
  const galleryButton = makeButton('▧ اختيار صورة', gallery);
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.style.cssText = 'flex-basis:100%;text-align:center;font-size:13px';
  wrap.append(cameraButton, galleryButton, camera, gallery, status);
  container.append(wrap);
  let busy = false;
  const handle = async input => {
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true;
    cameraButton.disabled = galleryButton.disabled = true;
    status.textContent = '';
    try {
      const blob = await openAvatarCropper(file);
      if (!blob) return;
      const response = await fetch('/api/social/avatar', {
        method: 'POST', credentials: 'same-origin',
        headers: {'content-type': 'image/jpeg'}, body: blob
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'تعذر حفظ الصورة');
      status.textContent = 'تم حفظ الصورة الشخصية';
      await options.onSaved?.();
    } catch (error) {
      const message = error?.message || 'تعذر معالجة الصورة';
      status.textContent = message;
      options.onError?.(message);
    } finally {
      busy = false;
      cameraButton.disabled = galleryButton.disabled = false;
    }
  };
  camera.addEventListener('change', () => handle(camera));
  gallery.addEventListener('change', () => handle(gallery));
  return () => wrap.remove();
}
