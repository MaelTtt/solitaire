<script lang="ts">
	const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`;

	const FRAG = `precision highp float;
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

	function balatro(cv: HTMLCanvasElement) {
		const raw = cv.getContext('webgl2') || cv.getContext('webgl');
		if (!raw) { console.error('[bg] no webgl'); return {}; }
		const gl = raw as WebGLRenderingContext;

		function sh(type: number, src: string) {
			const s = gl.createShader(type)!;
			gl.shaderSource(s, src); gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
				console.error('[bg] shader:', gl.getShaderInfoLog(s));
			return s;
		}
		const prog = gl.createProgram()!;
		gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			console.error('[bg] link:', gl.getProgramInfoLog(prog)); return {};
		}
		gl.useProgram(prog);

		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
		const ap = gl.getAttribLocation(prog, 'p');
		gl.enableVertexAttribArray(ap);
		gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);

		const uR = gl.getUniformLocation(prog, 'R');
		const uT = gl.getUniformLocation(prog, 'T');

		function resize() {
			const dpr = window.devicePixelRatio || 1;
			cv.width = window.innerWidth * dpr;
			cv.height = window.innerHeight * dpr;
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		}
		resize();
		window.addEventListener('resize', resize, { passive: true });

		let raf: number;
		const t0 = performance.now();
		(function frame() {
			gl.uniform2f(uR, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.uniform1f(uT, (performance.now() - t0) / 1000);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			raf = requestAnimationFrame(frame);
		})();

		return { destroy() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); } };
	}
</script>

<canvas use:balatro style="position:fixed;inset:0;z-index:0;display:block;width:100%;height:100%"></canvas>
