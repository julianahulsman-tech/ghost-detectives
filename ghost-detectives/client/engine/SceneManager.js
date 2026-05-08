import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.04);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 120);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.6;
    document.body.prepend(this.renderer.domElement);

    this._setupComposer();
    this._nightVisionActive = false;

    window.addEventListener('resize', () => this._onResize());
  }

  _setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Night-vision pass (off by default)
    const nvShader = {
      uniforms: {
        tDiffuse: { value: null },
        active: { value: 0.0 },
        intensity: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float active;
        uniform float intensity;
        varying vec2 vUv;
        void main() {
          vec4 col = texture2D(tDiffuse, vUv);
          float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
          vec3 nv = vec3(0.0, lum * 2.0, 0.0);
          gl_FragColor = vec4(mix(col.rgb, nv, active), col.a);
        }
      `,
    };
    this.nvPass = new ShaderPass(nvShader);
    this.composer.addPass(this.nvPass);
  }

  setNightVision(on) {
    this._nightVisionActive = on;
    this.nvPass.uniforms.active.value = on ? 1.0 : 0.0;
    document.getElementById('nv-overlay').style.opacity = on ? '1' : '0';
  }

  get nightVisionActive() { return this._nightVisionActive; }

  render() {
    this.composer.render();
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }
}
