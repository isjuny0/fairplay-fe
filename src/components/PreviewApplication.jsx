import * as previewRuntime from '../mock/preview.js';
import { getMockState } from '../mock/planned.js';
import Application from './Application.jsx';

const runtime = { ...previewRuntime, getMockState };

export default function PreviewApplication() {
  return <Application previewRuntime={runtime} />;
}
