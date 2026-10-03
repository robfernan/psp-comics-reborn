import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 v_uv;
void main() {
  v_uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;

  float t = u_time * 0.8;

  float wave1 = sin(uv.x * 3.0 + t * 0.5) * 0.12 + 0.5;
  float wave2 = cos(uv.x * 2.0 - t * 0.3) * 0.08 + 0.48;
  float wave3 = sin(uv.x * 4.5 + t * 0.7) * 0.05 + 0.52;

  float dist1 = abs(uv.y - wave1);
  float dist2 = abs(uv.y - wave2);
  float dist3 = abs(uv.y - wave3);

  float intensity = 0.0;
  intensity += 0.018 / (dist1 + 0.05);
  intensity += 0.015 / (dist2 + 0.07);
  intensity += 0.012 / (dist3 + 0.04);

  vec3 flameColor = vec3(217.0 / 255.0, 74.0 / 255.0, 23.0 / 255.0);
  vec3 edgeTint = vec3(120.0 / 255.0, 20.0 / 255.0, 15.0 / 255.0);
  vec3 activeRibbon = mix(edgeTint, flameColor, intensity * 0.5);

  float alpha = clamp(intensity * 0.8, 0.0, 1.0);
  gl_FragColor = vec4(activeRibbon * intensity, alpha);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error('Unable to create WebGL shader.');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile failure.';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

    if (!gl) {
      return;
    }

    try {
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      const program = gl.createProgram();

      if (!program) {
        return;
      }

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return;
      }

      gl.useProgram(program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);

      const positionLocation = gl.getAttribLocation(program, 'position');
      const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      const timeLocation = gl.getUniformLocation(program, 'u_time');

      if (positionLocation < 0 || !resolutionLocation || !timeLocation) {
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return;
      }

      const buffer = gl.createBuffer();

      if (!buffer) {
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1,
          1, -1,
          -1, 1,
          -1, 1,
          1, -1,
          1, 1,
        ]),
        gl.STATIC_DRAW,
      );

      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      let animationFrame = 0;

      const resize = () => {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.floor(window.innerWidth * pixelRatio);
        const height = Math.floor(window.innerHeight * pixelRatio);

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }
      };

      const render = (time: number) => {
        resize();
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.uniform1f(timeLocation, time * 0.001);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        animationFrame = window.requestAnimationFrame(render);
      };

      resize();
      animationFrame = window.requestAnimationFrame(render);
      window.addEventListener('resize', resize);

      return () => {
        window.removeEventListener('resize', resize);
        window.cancelAnimationFrame(animationFrame);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
      };
    } catch {
      return;
    }
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-10 pointer-events-none h-full w-full" />;
}