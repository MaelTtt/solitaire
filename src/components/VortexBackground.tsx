import { useEffect, useRef } from 'preact/hooks';

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`;

const FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 R;uniform float T;
#define C1 vec4(0.32,0.70,0.63,1)
#define C2 vec4(0.17,0.53,0.47,1)
#define C3 vec4(0.13,0.33,0.28,1)
#define SA 0.35
#define PF 745.0
#define CT 1.8
#define LG 0.06
void main(){
  float ps=length(R)/PF;
  vec2 uv=(floor(gl_FragCoord.xy*(1./ps))*ps-0.5*R)/R;
  float ul=length(uv);
  float spd=-2.0*0.2+302.2+T*0.06;
  float ang=atan(uv.y,uv.x)+spd-3.0*(SA*ul+(1.-SA));
  uv=vec2(ul*cos(ang),ul*sin(ang));
  uv*=13.;
  float t=T*3.;
  vec2 uv2=vec2(uv.x+uv.y);
  for(int i=0;i<5;i++){
    uv2+=sin(max(uv.x,uv.y))+uv;
    uv+=0.5*vec2(cos(5.1123314+0.353*uv2.y+t*0.131121),sin(uv2.x-0.113*t));
    uv-=cos(uv.x+uv.y)-sin(uv.x*0.711-uv.y);
  }
  float cm=0.25*CT+0.5*SA+1.2;
  float pr=min(2.,max(0.,length(uv)*0.020*cm));
  float c1=max(0.,1.-cm*abs(1.-pr));
  float c2=max(0.,1.-cm*abs(pr));
  float c3=1.-min(1.,c1+c2);
  float li=(LG-0.2)*max(c1*5.-4.,0.)+LG*max(c2*5.-4.,0.);
  vec4 col=(0.3/CT)*C1+(1.-0.3/CT)*(C1*c1+C2*c2+vec4(c3*C3.rgb,c3*C1.a))+li;
  gl_FragColor=vec4(col.rgb*0.88,col.a);
}`;

const drawFallback = (canvas: HTMLCanvasElement) => {
	const ctx = canvas.getContext('2d');
	if (!ctx) return undefined;
	const buffer = document.createElement('canvas');
	const bctx = buffer.getContext('2d');
	if (!bctx) return undefined;

	let raf = 0;
	const start = performance.now();
	let lastFrame = 0;

	const resize = () => {
		const vw = Math.max(1, window.innerWidth);
		const vh = Math.max(1, window.innerHeight);
		canvas.width = vw;
		canvas.height = vh;
		const target = 256;
		const scale = target / Math.max(vw, vh);
		buffer.width = Math.max(64, Math.round(vw * scale));
		buffer.height = Math.max(64, Math.round(vh * scale));
		ctx.imageSmoothingEnabled = true;
	};

	const frame = (now = performance.now()) => {
		if (now - lastFrame < 50) {
			raf = requestAnimationFrame(frame);
			return;
		}
		lastFrame = now;
		const w = buffer.width;
		const h = buffer.height;
		const image = bctx.createImageData(w, h);
		const data = image.data;
		const time = (now - start) / 1000;
		const len = Math.hypot(w, h);
		const ps = len / 745;
		const speed = 301.8 + time * 0.06;

		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				let ux = (Math.floor(x / ps) * ps - w * 0.5) / w;
				let uy = (Math.floor(y / ps) * ps - h * 0.5) / h;
				const ul = Math.hypot(ux, uy);
				const ang = Math.atan2(uy, ux) + speed - 3 * (0.35 * ul + 0.65);
				ux = ul * Math.cos(ang) * 13;
				uy = ul * Math.sin(ang) * 13;
				let u2x = ux + uy;
				let u2y = ux + uy;
				const t = time * 3;
				for (let i = 0; i < 5; i++) {
					const s = Math.sin(Math.max(ux, uy));
					u2x += s + ux;
					u2y += s + uy;
					ux += 0.5 * Math.cos(5.1123314 + 0.353 * u2y + t * 0.131121);
					uy += 0.5 * Math.sin(u2x - 0.113 * t);
					const d = Math.cos(ux + uy) - Math.sin(ux * 0.711 - uy);
					ux -= d;
					uy -= d;
				}
				const pr = Math.min(2, Math.max(0, Math.hypot(ux, uy) * 0.02 * 1.805));
				const c1 = Math.max(0, 1 - 1.805 * Math.abs(1 - pr));
				const c2 = Math.max(0, 1 - 1.805 * Math.abs(pr));
				const c3 = 1 - Math.min(1, c1 + c2);
				const li = -0.14 * Math.max(c1 * 5 - 4, 0) + 0.06 * Math.max(c2 * 5 - 4, 0);
				const mix = 0.8333333333;
				const r = (0.0533333333 * 0.32 + mix * (0.32 * c1 + 0.17 * c2 + 0.13 * c3) + li) * 224.4;
				const g = (0.0533333333 * 0.7 + mix * (0.7 * c1 + 0.53 * c2 + 0.33 * c3) + li) * 224.4;
				const b = (0.0533333333 * 0.63 + mix * (0.63 * c1 + 0.47 * c2 + 0.28 * c3) + li) * 224.4;
				const idx = (y * w + x) * 4;
				data[idx] = Math.max(0, Math.min(255, r));
				data[idx + 1] = Math.max(0, Math.min(255, g));
				data[idx + 2] = Math.max(0, Math.min(255, b));
				data[idx + 3] = 255;
			}
		}
		bctx.putImageData(image, 0, 0);
		ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
		raf = requestAnimationFrame(frame);
	};

	resize();
	frame();
	window.addEventListener('resize', resize, { passive: true });
	return () => {
		cancelAnimationFrame(raf);
		window.removeEventListener('resize', resize);
	};
};

export function VortexBackground() {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = ref.current;
		if (!canvas) return;
		const options = { alpha: false, antialias: false, depth: false, stencil: false };
		const gl = (canvas.getContext('webgl2', options) || canvas.getContext('webgl', options)) as WebGLRenderingContext | null;
		if (!gl) return drawFallback(canvas);

		const shader = (type: number, source: string) => {
			const s = gl.createShader(type);
			if (!s) throw new Error('Unable to create shader');
			gl.shaderSource(s, source);
			gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
				console.warn(gl.getShaderInfoLog(s));
				gl.deleteShader(s);
				return null;
			}
			return s;
		};

		const program = gl.createProgram();
		if (!program) return drawFallback(canvas);
		const vert = shader(gl.VERTEX_SHADER, VERT);
		const frag = shader(gl.FRAGMENT_SHADER, FRAG);
		if (!vert || !frag) return drawFallback(canvas);
		gl.attachShader(program, vert);
		gl.attachShader(program, frag);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.warn(gl.getProgramInfoLog(program));
			return drawFallback(canvas);
		}
		gl.useProgram(program);
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
		const attr = gl.getAttribLocation(program, 'p');
		if (attr < 0) return drawFallback(canvas);
		gl.enableVertexAttribArray(attr);
		gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
		const uR = gl.getUniformLocation(program, 'R');
		const uT = gl.getUniformLocation(program, 'T');
		let raf = 0;
		const start = performance.now();

		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			canvas.width = window.innerWidth * dpr;
			canvas.height = window.innerHeight * dpr;
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		};

		const frame = () => {
			gl.uniform2f(uR, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.uniform1f(uT, (performance.now() - start) / 1000);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			raf = requestAnimationFrame(frame);
		};

		resize();
		frame();
		window.addEventListener('resize', resize, { passive: true });
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
		};
	}, []);

	return <canvas ref={ref} class="vortex" />;
}
