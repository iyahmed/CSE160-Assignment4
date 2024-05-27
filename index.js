// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program

var VSHADER_SOURCE = `
  precision mediump float;
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  attribute vec3 a_Normal;
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_VertPos;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_NormalMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
    v_Normal = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 1)));
    v_VertPos = u_ModelMatrix * a_Position;
  }`;


// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_VertPos;
  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform int u_whichTexture;
  uniform bool u_lightsOn;
  uniform vec3 u_cameraPos;
  uniform vec3 u_normalLightPos;
  uniform vec3 u_normalLightColor;
  uniform bool u_normalLightOn;
  uniform vec3 u_spotlightPos;
  uniform vec3 u_spotlightDir;
  uniform vec3 u_spotlightColor;
  uniform float u_spotlightCutoffAngle;
  uniform bool u_spotlightOn;
  void main() {
      if (u_whichTexture == -3) {
        gl_FragColor = vec4((v_Normal+1.0)/2.0, 1.0); // Use normal
      
      } else if (u_whichTexture == -2) {             // Use color
        gl_FragColor = u_FragColor;

      } else if (u_whichTexture == -1) {      // Use UV debug color
        gl_FragColor = vec4(v_UV,1.0,1.0);

      } else if (u_whichTexture == 0) {       // Use texture0
        gl_FragColor = texture2D(u_Sampler0, v_UV);
      
      } else if (u_whichTexture == 1) {       // Use texture1
        gl_FragColor = texture2D(u_Sampler1, v_UV);
      
      } else {                                // Error, put Reddish
        gl_FragColor = vec4(1,.2,.2,1);

      }


      if (u_lightsOn) {
        vec3 spotlightVector = u_spotlightPos - vec3(v_VertPos);
        float theta = dot(normalize(-u_spotlightDir), spotlightVector);
        if (u_spotlightOn) {
          // Implementing Phong spotlighting
          if (theta > u_spotlightCutoffAngle) {
            // Implementing normal Phong lighting
            float r = length(spotlightVector);
            
            // N dot L
            vec3 spotL = normalize(spotlightVector);
            vec3 spotN = normalize(v_Normal);
            float spotnDotL = max(dot(spotN, spotL), 0.0);

            // Reflection
            vec3 spotR = reflect(-spotL, spotN);

            // Eye
            vec3 spotE = normalize(u_cameraPos - vec3(v_VertPos));
            
            // Specular
            float spotSpecular = pow(max(dot(spotE, spotR), 0.0), 64.0) * 0.8;

            // Diffuse
            vec3 spotDiffuse = vec3(1.0, 1.0, 0.9) * vec3(gl_FragColor) * spotnDotL * 0.7;

            // Ambient
            vec3 spotAmbient = vec3(gl_FragColor) * 0.2;

            if (u_whichTexture == 0 || u_whichTexture == 1) {
              gl_FragColor = vec4(spotSpecular+spotDiffuse+spotAmbient * vec3(u_spotlightColor), 1.0);
            } else if (u_whichTexture == 1) {
              gl_FragColor = vec4(spotSpecular+spotDiffuse+spotAmbient * vec3(u_spotlightColor), 1.0);
            } else {
              gl_FragColor = vec4(spotDiffuse+spotAmbient * vec3(u_spotlightColor), 1.0);
            }
          }
        }
        if (u_normalLightOn) {
          // Implementing normal Phong lighting
          vec3 lightVector = u_normalLightPos - vec3(v_VertPos);
          float r = length(lightVector);

          // N dot L
          vec3 L = normalize(lightVector);
          vec3 N = normalize(v_Normal);
          float nDotL = max(dot(N, L), 0.0);

          // Reflection
          vec3 R = reflect(-L, N);

          // Eye
          vec3 E = normalize(u_cameraPos - vec3(v_VertPos));
          
          // Specular
          float specular = pow(max(dot(E, R), 0.0), 64.0) * 0.8;

          // Diffuse
          vec3 diffuse = vec3(1.0, 1.0, 0.9) * vec3(gl_FragColor) * nDotL * 0.7;

          // Ambient
          vec3 ambient = vec3(gl_FragColor) * 0.2;

          if (u_whichTexture == 0 || u_whichTexture == 1) {
            gl_FragColor = vec4(specular+diffuse+ambient * vec3(u_normalLightColor), 1.0);
          } else if (u_whichTexture == 1) {
            gl_FragColor = vec4(specular+diffuse+ambient * vec3(u_normalLightColor), 1.0);
          } else {
            gl_FragColor = vec4(diffuse+ambient * vec3(u_normalLightColor), 1.0);
          }
        }
      }
  }`


// Globals for the WebGL setup
let canvas, gl, a_Position, a_UV, a_Normal, u_FragColor, u_Size, u_ModelMatrix, u_NormalMatrix, u_ProjectionMatrix, u_ViewMatrix, u_GlobalRotateMatrix, u_Sampler0, u_Sampler1, u_whichTexture, u_lightsOn, u_cameraPos, u_normalLightOn,u_normalLightPos, u_normalLightColor, u_spotlightOn, u_spotlightPos, u_spotlightDir, u_spotlightColor, u_spotlightCutoffAngle;
// Global for the global sideways camera angle
let g_globalAngle = 0;
// Globals for the performance calculation
var g_startTime = performance.now() / 1000.0;
var g_seconds = performance.now() / 1000.0 - g_startTime;
var fps = 60;
var fpsDelta = 1000 / fps;
var previous = performance.now();
var start;
// Globals for the perspective camera
var g_camera = new Camera();
var g_eye = g_camera.eye.elements;
var g_at = g_camera.at.elements;
var g_up = g_camera.up.elements;
var rotateDelta = -0.2; // In degrees
// Global for the renderScene() function
var g_shapesList = [];
var projMat = new Matrix4();
// Global for map walls
// var g_path = [
//   // For 32 x 32
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
//    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
//    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
//    1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
//    1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
//    1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
//    1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
//    1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
//    1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
//   // Halfway through 32 x 32
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
//    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
//    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0,
//    1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
//    1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1,
//    1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
//    1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1,
//    1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
//    1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
//    1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
//   [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
//   [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
//   [0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
//   [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0,
//    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
//   [1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1,
//     1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
//   [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
//    0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1],
//   [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1,
//    0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0],
// ];
// let perlinNoise = initPerlinNoise();
// let perlinHeights = [];
// Globals related to my Blocky Animal
// Front-Left Leg's Globals
let g_frontLeftLegThighAngle = 0;
let g_frontLeftLegPawAngle = 0;
let g_frontLeftLegThighAnimation = false;
let g_frontLeftLegPawAnimation = false;
// Front-Right Leg's Globals
let g_frontRightLegThighAngle = 0;
let g_frontRightLegPawAngle = 0;
let g_frontRightLegThighAnimation = false;
let g_frontRightLegPawAnimation = false;
// Back-Left Leg's Globals
let g_backLeftLegThighAngle = 0;
let g_backLeftLegPawAngle = 0;
let g_backLeftLegThighAnimation = false;
let g_backLeftLegPawAnimation = false;
// Back-Right Leg's Globals
let g_backRightLegThighAngle = 0;
let g_backRightLegPawAngle = 0;
let g_backRightLegThighAnimation = false;
let g_backRightLegPawAnimation = false;
// Bottom Tail's Globals
let g_tailAngle = 0;
let g_tailAnimation = false;
// Global for the normals
g_normalOn = false;
// Global for all lights
let g_lightsOn = true; 
// Global for the normal light
let g_normalLightOn = true; 
let g_normalLightPos = [0, 1, -2];
let g_normalLightColor = [1, 1, 1];
let g_normalLightAnimationOn = true;
// Global for the spotlight
let g_spotlightOn = true; 
let g_spotlightPos = [0, 1, -2];
let g_spotlightDir = [0, -1, 0];
let g_spotlightColor = [1, 1, 1];
let g_spotlightCutoffAngle = Math.cos(Math.PI / 9); // 20 degree default cutoff


function setupWebGL() {
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  gl.enable(gl.DEPTH_TEST);
}


function connectVariablesToGLSL() {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return;
  }

  // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }
  
  // Get the storage location of a_UV
  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  if (a_UV < 0) {
    console.log('Failed to get the storage location of a_UV');
    return;
  }

  // Set the storage location of a_Position
  a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  if (a_Normal < 0) {
    console.log('Failed to get the storage location of a_Normal');
    return;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  // Get the storage location of u_ModelMatrix
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }

  // Get the storage location of u_NormalMatrix
  u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  if (!u_NormalMatrix) {
    console.log('Failed to get the storage location of u_NormalMatrix');
    return;
  }
  
  // Get the storage location of u_ViewMatrix
  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  if (!u_ViewMatrix) {
    console.log('Failed to get the storage location of u_ViewMatrix');
    return;
  }
  
  // Get the storage location of u_ProjectionMatrix
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  if (!u_ProjectionMatrix) {
    console.log('Failed to get the storage location of u_ProjectionMatrix');
    return;
  }

  // Get the storage location of u_GlobalRotateMatrix
  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  if (!u_GlobalRotateMatrix) {
    console.log('Failed to get the storage location of u_GlobalRotateMatrix');
    return;
  }

  // Get the storage location of u_Sampler0
  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  if (!u_Sampler0) {
    console.log('Failed to get the storage location of u_Sampler0');
    return false;
  }
  
  // Get the storage location of u_Sampler1
  u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
  if (!u_Sampler1) {
    console.log('Failed to get the storage location of u_Sampler1');
    return false;
  }
  
  // Get the storage location of u_Sampler
  u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
  if (!u_whichTexture) {
    console.log('Failed to get the storage location of u_whichTexture');
    return false;
  }
  
  // Get the storage location of u_lightOn
  u_lightsOn = gl.getUniformLocation(gl.program, 'u_lightsOn');
  if (!u_lightsOn) {
    console.log('Failed to get the storage location of u_lightsOn');
    return false;
  }

  // Get the storage location of u_cameraPos
  u_cameraPos = gl.getUniformLocation(gl.program, 'u_cameraPos');
  if (!u_cameraPos) {
    console.log('Failed to get the storage location of u_cameraPos');
    return false;
  }

  // Get the storage location of u_normalLightOn
  u_normalLightOn = gl.getUniformLocation(gl.program, 'u_normalLightOn');
  if (!u_normalLightOn) {
    console.log('Failed to get the storage location of u_normalLightOn');
    return false;
  }

  // Get the storage location of u_normalLightPos
  u_normalLightPos = gl.getUniformLocation(gl.program, 'u_normalLightPos');
  if (!u_normalLightPos) {
    console.log('Failed to get the storage location of u_normalLightPos');
    return false;
  }

  // Get the storage location of u_normalLightColor
  u_normalLightColor = gl.getUniformLocation(gl.program, 'u_normalLightColor');
  if (!u_normalLightColor) {
    console.log('Failed to get the storage location of u_normalLightColor');
    return false;
  }

  // Get the storage location of u_spotLightOn
  u_spotlightOn = gl.getUniformLocation(gl.program, 'u_spotlightOn');
  if (!u_spotlightOn) {
    console.log('Failed to get the storage location of u_spotlightOn');
    return false;
  }

  // Get the storage location of u_normalLightPos
  u_spotlightPos = gl.getUniformLocation(gl.program, 'u_spotlightPos');
  if (!u_spotlightPos) {
    console.log('Failed to get the storage location of u_spotlightPos');
    return false;
  }

  // Get the storage location of u_normalLightPos
  u_spotlightDir = gl.getUniformLocation(gl.program, 'u_spotlightDir');
  if (!u_spotlightDir) {
    console.log('Failed to get the storage location of u_spotlightDir');
    return false;
  }

  // Get the storage location of u_normalLightColor
  u_spotlightColor = gl.getUniformLocation(gl.program, 'u_spotlightColor');
  if (!u_spotlightColor) {
    console.log('Failed to get the storage location of u_spotlightColor');
    return false;
  }

  // Set an initial value for the matrix to identify
  var identityM = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityM.elements);
  gl.uniformMatrix4fv(u_NormalMatrix, false, identityM.elements);
}


// Set up actions for the HTMl UI elements
function addActionsForHTMLUI() {
  // Front-Left Leg's Button Events
  document.getElementById('animationfrontLeftLegThighOffButton').onclick = function () { g_frontLeftLegThighAnimation = false; };
  document.getElementById('animationfrontLeftLegThighOnButton').onclick = function () { g_frontLeftLegThighAnimation = true; };
  document.getElementById('animationfrontLeftLegPawOffButton').onclick = function () { g_frontLeftLegPawAnimation = false; };
  document.getElementById('animationfrontLeftLegPawOnButton').onclick = function () { g_frontLeftLegPawAnimation = true; };

  // Front-Right Leg's Button Events
  document.getElementById('animationfrontRightLegThighOffButton').onclick = function () { g_frontRightLegThighAnimation = false; };
  document.getElementById('animationfrontRightLegThighOnButton').onclick = function () { g_frontRightLegThighAnimation = true; };
  document.getElementById('animationfrontRightLegPawOffButton').onclick = function () { g_frontRightLegPawAnimation = false; };
  document.getElementById('animationfrontRightLegPawOnButton').onclick = function () { g_frontRightLegPawAnimation = true; };
  document.getElementById('animationfrontLeftLegThighOffButton').onclick = function () { g_frontLeftLegThighAnimation = false; };

  // Back-Left Leg's Button Events
  document.getElementById('animationbackLeftLegThighOnButton').onclick = function () { g_backLeftLegThighAnimation = true; };
  document.getElementById('animationbackLeftLegThighOffButton').onclick = function () { g_backLeftLegThighAnimation = false; };
  document.getElementById('animationbackLeftLegPawOffButton').onclick = function () { g_backLeftLegPawAnimation = false; };
  document.getElementById('animationbackLeftLegPawOnButton').onclick = function () { g_backLeftLegPawAnimation = true; };

  // Back-Right Leg's Button Events
  document.getElementById('animationbackRightLegThighOffButton').onclick = function () { g_backRightLegThighAnimation = false; };
  document.getElementById('animationbackRightLegThighOnButton').onclick = function () { g_backRightLegThighAnimation = true; };
  document.getElementById('animationbackRightLegPawOffButton').onclick = function () { g_backRightLegPawAnimation = false; };
  document.getElementById('animationbackRightLegPawOnButton').onclick = function () { g_backRightLegPawAnimation = true; };
  
  // Tail's Button Events
  document.getElementById('animationTailOffButton').onclick = function () { g_tailAnimation = false; };
  document.getElementById('animationTailOnButton').onclick = function () { g_tailAnimation = true; };
  
  // Normals' Button Events
  document.getElementById('normalOn').onclick = function () { g_normalOn = true; }
  document.getElementById('normalOff').onclick = function () { g_normalOn = false; }

  // All Lights' Button Events
  document.getElementById('lightsOn').onclick = function () { g_lightsOn = true; }
  document.getElementById('lightsOff').onclick = function () { g_lightsOn = false; }

  // Normal Light's Button Events
  document.getElementById('normalLightOn').onclick = function () { g_lightsOn = true; }
  document.getElementById('normalLightOff').onclick = function () { g_lightsOn = false; }
  document.getElementById('normalLightAnimationOnButton').onclick = function () { g_normalLightAnimationOn = true; }
  document.getElementById('normalLightAnimationOffButton').onclick = function () { g_normalLightAnimationOn = false; }

  // Spotlight's Button Events
  document.getElementById('spotlightOn').onclick = function () { g_spotlightOn = true; }
  document.getElementById('spotlightOff').onclick = function () { g_spotlightOn = false; }

  // Front-Left Leg's Color Slider Events
  document.getElementById('frontLeftLegPawSlide').addEventListener('mousemove', function () { g_frontLeftLegPawAngle = this.value; renderScene(); });
  document.getElementById('frontLeftLegThighSlide').addEventListener('mousemove', function () { g_frontLeftLegThighAngle = this.value; renderScene(); });
  
  // Front-Right Leg's Color Slider Events
  document.getElementById('frontRightLegPawSlide').addEventListener('mousemove', function () { g_frontRightLegPawAngle = this.value; renderScene(); });
  document.getElementById('frontRightLegThighSlide').addEventListener('mousemove', function () { g_frontRightLegThighAngle = this.value; renderScene(); });

  // Back-Left Leg's Color Slider Events
  document.getElementById('backLeftLegPawSlide').addEventListener('mousemove', function () { g_backLeftLegPawAngle = this.value; renderScene(); });
  document.getElementById('backLeftLegThighSlide').addEventListener('mousemove', function () { g_backLeftLegThighAngle = this.value; renderScene(); });

  // Back-Right Leg's Color Slider Events
  document.getElementById('backRightLegPawSlide').addEventListener('mousemove', function () { g_backRightLegPawAngle = this.value; renderScene(); });
  document.getElementById('backRightLegThighSlide').addEventListener('mousemove', function () { g_backRightLegThighAngle = this.value; renderScene(); });
  
  // Tail's Color Slider Event
  document.getElementById('tailSlide').addEventListener('mousemove', function () { g_TailAngle = this.value; renderScene(); });

  // Angle's Slider Event
  document.getElementById('angleSlide').addEventListener('mousemove', function () { g_globalAngle = this.value; renderScene(); });
  
  // Normal Light's Slider Events
  document.getElementById('normalLightPositionSlideX').addEventListener('mousemove', function () { g_normalLightPos[0] = this.value / 100; renderScene(); });
  document.getElementById('normalLightPositionSlideY').addEventListener('mousemove', function () { g_normalLightPos[1] = this.value / 100; renderScene(); });
  document.getElementById('normalLightPositionSlideZ').addEventListener('mousemove', function () { g_normalLightPos[2] = this.value / 100; renderScene(); });
  document.getElementById('normalLightColorRedSlide').addEventListener('mousemove', function () { g_normalLightColor[0] = parseFloat(this.value); renderScene(); });
  document.getElementById('normalLightColorBlueSlide').addEventListener('mousemove', function () { g_normalLightColor[1] = parseFloat(this.value); renderScene(); });
  document.getElementById('normalLightColorGreenSlide').addEventListener('mousemove', function () { g_normalLightColor[2] = parseFloat(this.value); renderScene(); });

  // Spotlight's Slider Events
  document.getElementById('spotlightPositionSlideX').addEventListener('mousemove', function () { g_spotlightPos[0] = this.value / 100; renderScene(); });
  document.getElementById('spotlightPositionSlideY').addEventListener('mousemove', function () { g_spotlightPos[1] = this.value / 100; renderScene(); });
  document.getElementById('spotlightPositionSlideZ').addEventListener('mousemove', function () { g_spotlightPos[2] = this.value / 100; renderScene(); });
  document.getElementById('spotlightDirectionSlideX').addEventListener('mousemove', function () { g_spotlightDir[0] = this.value / 100; renderScene(); });
  document.getElementById('spotlightDirectionSlideY').addEventListener('mousemove', function () { g_spotlightDir[1] = this.value / 100; renderScene(); });
  document.getElementById('spotlightDirectionSlideZ').addEventListener('mousemove', function () { g_spotlightDir[2] = this.value / 100; renderScene(); });
  document.getElementById('spotlightColorRedSlide').addEventListener('mousemove', function () { g_spotlightColor[0] = parseFloat(this.value); renderScene(); });
  document.getElementById('spotlightColorBlueSlide').addEventListener('mousemove', function () { g_spotlightColor[1] = parseFloat(this.value); renderScene(); });
  document.getElementById('spotlightColorGreenSlide').addEventListener('mousemove', function () { g_spotlightColor[2] = parseFloat(this.value); renderScene(); });
  document.getElementById('spotlightCutoffAngleSlide').addEventListener('mousemove', function () { g_spotlightCutoffAngle = parseFloat(Math.cos(Math.PI / 180 * this.value)); renderScene(); });
}


function initTextures(gl, n) {
  // Create the image objects
  var image0 = new Image();  // Create the image object for texture 0
  if (!image0) {
    console.log('Failed to create the image0 object');
    return false;
  }
  var image1 = new Image();  // Create the image object for texture 1
  if (!image1) {
    console.log('Failed to create the image1 object');
    return false;
  }

  // Load all the images for the textures async
  image0.onload = function () {
    sendImageToTEXTURE0(image0);
    image1.onload = function () {
      sendImageToTEXTURE1(image1);
    };
    image1.src = 'pinkflower.jpg';
  };
  image0.src = 'sky.jpg';

  return true;
}


function sendImageToTEXTURE0(image) {
  var texture = gl.createTexture();   // Create a texture object
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }
  
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit0
  gl.activeTexture(gl.TEXTURE0);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  
  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler0, 0);

  console.log("Finished loading the texture for TEXTURE0");
}


function sendImageToTEXTURE1(image) {
  var texture = gl.createTexture();   // Create a texture object
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }
  
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit1
  gl.activeTexture(gl.TEXTURE1);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  
  // Set the texture unit 1 to the sampler
  gl.uniform1i(u_Sampler1, 1);
  
  console.log("Finished loading the texture for TEXTURE1");
}


function main() {
  // Set up canvas and gl variables
  setupWebGL();

  // Set up GLSL shader progress and other GLSL variables 
  connectVariablesToGLSL();

  // Set up actions for the HTML UI elements
  addActionsForHTMLUI();

  // Register function (event handler) to be called on a mouse press
  document.onkeydown = keydown;

  // For mouse movements
  // Mouse movement constants
  let dragging = false;
  let lastX = -1;
  let lastY = -1;
  let theta = 0;
  let phi = Math.PI / 2; // Default value avoids the viewpoint jumping to the top by default
  // Dragging the mouse
  canvas.addEventListener('mousedown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  // Letting go of the mouse
  canvas.addEventListener('mouseup', () => {
    dragging = false;
  })
  // Moving the mouse
  canvas.addEventListener('mousemove', (event) => {
    if (dragging) {
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      theta -= deltaX * 0.005; // Mouse sensitivity
      phi -= deltaY * 0.005; // Mouse sensitivity

      g_camera.updateCamera(theta, phi);
      gl.uniformMatrix4fv(u_ViewMatrix, false, g_camera.viewMatrix.elements);
      // renderScene();
    }
    lastX = event.clientX;
    lastY = event.clientY;
  });

  // Call the texture helper functions
  initTextures(gl, 0);

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Render scene
  // initPerlinTerrainHeight();
  start = previous;
  renderScene();
  requestAnimationFrame(tick);
}



// Called by browser repeatedly whenever its time
function tick() {
  // Save the current time
  g_seconds = performance.now() / 1000.0 - g_startTime;

  // Update Animation Angles
  updateAnimationAngles();

  // Tell the browser to update again when it has time
  requestAnimationFrame(tick);

  // Caps the FPS to 60
  var current = performance.now();
  var delta = current - previous;
  if (delta > fpsDelta) {
    previous = current - (delta % fpsDelta);

    // Draw everything
    renderScene();
  }
}


// Update the angles of everything if currently animated
function updateAnimationAngles() {
  // Delaying movement of the right legs compared to the left legs for realism
  if (g_frontLeftLegThighAnimation === true) {
    g_frontLeftLegThighAngle = (30 * Math.sin(g_seconds));
  }
  if (g_frontLeftLegThighAnimation === false) {
    g_frontLeftLegThighAngle = 0;
  }
  if (g_frontLeftLegPawAnimation === true) {
    g_frontLeftLegPawAngle = (30 * Math.sin(3 * g_seconds));
  }
  if (g_frontLeftLegPawAnimation === false) {
    g_frontLeftLegPawAngle = 0;
  }
  if (g_frontRightLegThighAnimation === true) {
    g_frontRightLegThighAngle = (30 * Math.cos(g_seconds));
  }
  if (g_frontRightLegThighAnimation === false) {
    g_frontRightLegThighAngle = 0;
  }
  if (g_frontRightLegPawAnimation === true) {
    g_frontRightLegPawAngle = (30 * Math.cos(3 * g_seconds));
  }
  if (g_frontRightLegPawAnimation === false) {
    g_frontRightLegPawAngle = 0;
  }
  if (g_backLeftLegThighAnimation === true) {
    g_backLeftLegThighAngle = (30 * Math.sin(g_seconds));
  }
  if (g_backLeftLegThighAnimation === false) {
    g_backLeftLegThighAngle = 0;
  }
  if (g_backLeftLegPawAnimation === true) {
    g_backLeftLegPawAngle = (30 * Math.sin(3 * g_seconds));
  }
  if (g_backLeftLegPawAnimation === false) {
    g_backLeftLegPawAngle = 0;
  }
  if (g_backRightLegThighAnimation === true) {
    g_backRightLegThighAngle = (30 * Math.cos(g_seconds));
  }
  if (g_backRightLegThighAnimation === false) {
    g_backRightLegThighAngle = 0;
  }
  if (g_backRightLegPawAnimation === true) {
    g_backRightLegPawAngle = (30 * Math.cos(3 * g_seconds));
  }
  if (g_backRightLegPawAnimation === false) {
    g_backRightLegPawAngle = 0;
  }
  if (g_tailAnimation === true) {
    g_tailAngle = (60 * Math.cos(g_seconds)); // The speed of tail-wagging is doubled compared to the speed of walking with a leg for realism
  }
  if (g_tailAnimation === false) {
    g_tailAngle = 0;
  }  

  if (g_normalLightAnimationOn === true) { // Simple circular light animation for the normal light
    g_normalLightPos[0] = Math.cos(g_seconds) * 16;
    // g_normalLightPos[1] = Math.cos(g_seconds) * 16;
    g_normalLightPos[2] = Math.cos(g_seconds) * 16;
  }
}


function keydown(ev) {
  if (ev.keyCode === 68) { // Moving right with the "D" key
   g_camera.right();
  } else {
    if (ev.keyCode === 65) { // Moving left with the "A" key
      g_camera.left();
    } else {
      if (ev.keyCode === 87) { // Moving forward with the "W" key
        g_camera.forward();
      } else {
        if (ev.keyCode === 83) { // Moving backward with the "S" key
          g_camera.back();
        } else if (ev.keyCode === 81) { // Turning the camera left with the "Q" key
          g_camera.panLeft();
        } else if (ev.keyCode === 69) { // Turing the camera right with the "R" key
          g_camera.panRight();
        }
      }
    }
  }

  renderScene();
}


// function initPerlinNoise() { // Generate the given Perlin height of terrian
//   // Initialize important values
//   let gradients = {};
//   let cache = {};

//   function dotProductGrid(x, y, ax, ay) { // Internal function for setting up the grid for the dot products
//     let dx = x - ax;
//     let dy = y - ay;
//     var grad;
//     var angle;
//     if (gradients[[ax, ay]]) { // If the gradient exists, use it. Otherwise, pseudorandomize it
//       grad = gradients[[ax, ay]];
//     } else {
//       angle = Math.random() * Math.PI * 2; // In degrees
//       grad = { x: Math.cos(angle), y: Math.sin(angle) };
//       gradients[[ax, ay]] = grad;
//     }

//     return grad.x * dx + grad.y * dy;
//   }

//   function smoothStep(t) { // Internal function for calculating a smooth step
//     return (3 - 2 * t) * t * t;
//   }

//   function perlin(x, y) { // Internal function for calculating Perlin noise
//     let xf = Math.floor(x);
//     let yf = Math.floor(y);
//     let tl = dotProductGrid(x, y, xf, yf);
//     let tr = dotProductGrid(x, y, xf + 1, yf);
//     let bl = dotProductGrid(x, y, xf, yf + 1);
//     let br = dotProductGrid(x, y, xf + 1, yf + 1);
//     let xt = smoothStep(x - xf);
//     let yt = smoothStep(y - yf);
//     let top = xt * (tr - tl) + tl;
//     let bottom = xt * (br - bl) + bl;
//     return yt * (bottom - top) + top;
//   }

//   return { noise: perlin };
// }


// function initPerlinTerrainHeight() { // Calculates and stores the height of render Perlin terrain 
//   for (let x = 0; x < 32; x++) {
//     perlinHeights[x] = [];
//     for (let z = 0; z < 32; z++) {
//       perlinHeights[x][z] = perlinNoise.noise(x, z); // Perlin terrain height
//     }
//   }
// }


// function drawMap() { // TODO: Extend this to 32 x 32
//   // Double loop for initial map wall draw
//   // TODO: Add collision detection by preventing the camera from moving where there is a wall
//   // Values for the pathway
//   var path = new Cube();
//   path.textureNum = -2;
//   path.color = [0.8, 1, 1, 1];
//   path.matrix.translate(0, -0.75, 0);
//   path.matrix.scale(0.3, 0.3, 0.3);

//   // Object for Perlin noise to generate the map
//   let perlin = new Cube();
//   perlin.matrix.setIdentity();
//   perlin.textureNum = -2;
//   perlin.color = [1, 0, 0, 1];

//   // Values for the Perlin noise
//   const terrainSize = 32; // To fit the 32 x 32 requirements
//   const maximumHeight = 10; // This is the maximum height of the terrian
//   for (x = 0; x < 32; x++) {
//     for (z = 0; z < 32; z++) {
//       // For the stairway path
//       if (g_path[x][z] === 1) { // For the stairway path
//         if (x >= 16 && z >= 16) {
//           path.matrix.translate(x % 1.25, 0.05, z % 1.25);
//         } else {
//           path.matrix.translate(-x % 1.25, 0.05, -z % 1.25);
//         }
//         path.renderfaster(); // TODO: Fix Cube.renderfast() // TODO: Fix Cube.renderfast()

//        // Calculating world coordinates
//         let worldX = (x - (terrainSize / 2)) * 1.0;
//         let worldZ = (z - (terrainSize / 2)) * 1.0;
        
//         for (let y = 0; y <= perlinHeights[x][z]; y++) {
//           let worldY = y - (maximumHeight / 2) + 5;
//           perlin.matrix.translate(worldX, worldY, worldZ);
//           perlin.matrix.scale(2, 2, 2);
//           // perlin.matrix.translate(x - offset, y - maximumPerlinHeight / 2, z - offset);
//           // perlin.matrix.scale(2.5, 2.5, 2.5);
//           perlin.renderfaster();
//         }  
//       }
//     }
//   }
// }


function renderScene() {
  // Check the time at the start of the function
  var startTime = performance.now();

  // Pass the projection matrix (not needed in the renderScene())
  // var projMat = new Matrix4();
  projMat.setIdentity();
  projMat.setPerspective(50, 1 * canvas.width / canvas.height, 1, 200);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, projMat.elements);
  
  // Pass the view matrix
  var viewMat = new Matrix4();
  viewMat.setLookAt(
    g_camera.eye.elements[0], g_camera.eye.elements[1], g_camera.eye.elements[2],
    g_camera.at.elements[0], g_camera.at.elements[1], g_camera.at.elements[2],
    g_camera.up.elements[0], g_camera.up.elements[1], g_camera.up.elements[2],
  ); // (eye, at, up)
  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMat.elements);

  // Pass the matrix to the u_ModelMatrix attribute
  var cameraRotMat = new Matrix4().rotate(rotateDelta, 0, 1, 0);
  gl.uniformMatrix4fv(u_ModelMatrix, false, cameraRotMat.elements);
  
  // Pass the matrix to the u_NormalMatrix attribute
  var normalMat = new Matrix4();
  normalMat.setInverseOf(cameraRotMat);
  normalMat.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMat.elements);

  // Pass the matrix to the u_GlobalRotateMatrix attribute
  var globalRotMat = new Matrix4().rotate(g_globalAngle, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.clear(gl.COLOR_BUFFER_BIT);
 
  // Draw the map's wall cubes
  // drawMap();

  // Pass the light attributes that apply for all lights to GLSL
  gl.uniform1i(u_lightsOn, g_lightsOn);
  gl.uniform3f(u_cameraPos, g_camera.eye.elements[0], g_camera.eye.elements[1], g_camera.eye.elements[2]);

  // Pass the light attributes for the normal light to GLSL
  gl.uniform1i(u_normalLightOn, g_normalLightOn);
  gl.uniform3f(u_normalLightPos, g_normalLightPos[0], g_normalLightPos[1], g_normalLightPos[2]);
  gl.uniform3f(u_normalLightColor, g_normalLightColor[0], g_normalLightColor[1], g_normalLightColor[2]);

  // Pass the light attributes for the spotlight to GLSL
  gl.uniform1i(u_spotlightOn, g_spotlightOn);
  gl.uniform3f(u_spotlightPos, g_spotlightPos[0], g_spotlightPos[1], g_spotlightPos[2]);
  gl.uniform3f(u_spotlightDir, g_spotlightDir[0], g_spotlightDir[1], g_spotlightDir[2]);
  gl.uniform3f(u_spotlightColor, g_spotlightColor[0], g_spotlightColor[1], g_spotlightColor[2]);
  gl.uniform1f(u_spotlightCutoffAngle, g_spotlightCutoffAngle);
  
  // Draw the normal light cube
  var normalLight = new Cube(); // Creating the normal light as a large rectangle
  normalLight.color = [2, 2, 0, 1]; // "Color" the normal light extra yellow
  if (g_normalOn === true) {
    normalLight.textureNum = -3; // Use the normals on the normal light
  } else {
    normalLight.textureNum = -2; // Use the colors on the normal light
  }
  normalLight.matrix.translate(g_normalLightPos[0], g_normalLightPos[1], g_normalLightPos[2]); // Setting the X, Y, and Z placements for the normal light 
  normalLight.matrix.scale(-0.1, -0.1, -0.1); // Scaling for the normal light with negatives for normals
  normalLight.matrix.translate(-0.5, -0.5, -0.5); // Setting the X, Y, and Z placements for the normal light
  normalLight.normalMatrix.setInverseOf(normalLight.matrix).transpose(); // Setting the normal matrix for the normal light
  normalLight.render(); // Rendering for the normal light

  // Draw the spotlight cube
  var spotlight = new Cube(); // Creating the spotlight as a large rectangle
  spotlight.color = [2, 0, 0, 1]; // "Color" the normal light extra red
  if (g_normalOn === true) {
    spotlight.textureNum = -3; // Use the normals on the spot light
  } else {
    spotlight.textureNum = -2; // Use the colors on the spot light
  }
  spotlight.matrix.translate(g_spotlightPos[0], g_spotlightPos[1], g_spotlightPos[2]); // Setting the X, Y, and Z placements for the spotlight 
  spotlight.matrix.scale(-0.1, -0.1, -0.1); // Scaling for the spotlight with negatives for normals
  spotlight.matrix.translate(-0.5, -0.5, -0.5); // Setting the X, Y, and Z placements for the spotlight
  spotlight.normalMatrix.setInverseOf(spotlight.matrix).transpose(); // Setting the normal matrix for the spotlight
  spotlight.render(); // Rendering for the spotlight
  
  // Draw the walls for the lighting
  // var walls = new Cube(); // Creating the walls as a large rectangle
  // walls.color = [0.8, 0.8, 0.8, 1]; // Color the walls white
  // if (g_normalOn === true) {
  //   walls.textureNum = -3; // Use the normals on the walls
  // } else {
  //   walls.textureNum = -2; // Use the colors on the walls
  // }
  // walls.matrix.scale(-5, -5, -5); // Scaling for the walls with negatives for normals
  // walls.matrix.translate(0, -0.75, 0.0); // Y placement for the walls
  // walls.matrix.translate(-0.5, 0, -0.5); // X and Z placement for the walls
  // walls.render(); // Rendering for the wall

  // Draw the sphere
  var sphere = new Sphere();
  if (g_normalOn === true) {
    sphere.textureNum = -3; // Use the normals on the sphere
  } else {
    sphere.textureNum = -2; // Use the UV coordinates on the sphere
  }
  sphere.matrix.translate(-2, 0.25, 0); // Setting the X and Y placements for the sphere
  sphere.render();

  // Draw the ground cube for 32 x 32
  var ground = new Cube(); // Creating the ground as a large rectangle
  ground.color = [0, 1, 0, 1]; // Color the ground green
  if (g_normalOn === true) {
    ground.textureNum = -3; // Use the normals on the ground
  } else {
    ground.textureNum = -2; // Use the colors on the ground
  }
  ground.matrix.translate(0, -0.75, 0.0); // Y placement for the ground
  ground.matrix.scale(32, 0.0001, 32); // Scaling for the ground
  ground.matrix.translate(-0.5, -0.001, -0.5); // X and Z placement for the ground
  ground.render(); // Rendering for the ground

  // Draw the sky cube for 100 x 100
  var sky = new Cube(); // Creating the sky as a large rectangle
  sky.color = [0, 0, 1, 1]; // Color the sky blue
  if (g_normalOn === true) {
    sky.textureNum = -3; // Use the normals on the sky
  } else {
    sky.textureNum = 0; // Use the texture0 on the sky
  }
  sky.matrix.scale(100, 100, 100); // Scaling for the sky
  sky.matrix.translate(-0.5, -0.5, -0.5); // X, Y, and Z placement for the sky
  sky.render(); // Rendering for the sky

  // Draw the statue's head cube
  var statueHead = new Cube(); // Creating the head as a small rectangle
  if (g_normalOn === true) {
    statueHead.textureNum = -3; // Use the normals on the walls
  } else {
    statueHead.textureNum = 0; // Use the texture0 on the head
  }
  statueHead.matrix.translate(-0.25, 0.5, 0.175); // X, Y, and Z placements for the head
  statueHead.matrix.scale(0.3, 0.3, 0.3); // Scaling for the head
  statueHead.render(); // Rendering for the head
 
  // Draw the statue's foot cube
  var statueFoot = new Cube(); // Creating the foot as a small rectangle
  if (g_normalOn === true) {
    statueFoot.textureNum = -3; // Use the normals on the foot
  } else {
    statueFoot.textureNum = 0; // Use the texture0 on the foot
  }
  statueFoot.matrix.translate(-0.425, -0.65, 0); // X and Y placements for the foot
  statueFoot.matrix.scale(.7, .5, .7); // Scaling for the foot
  statueFoot.render(); // Rendering for the foot

  // Draw the statue's body cube
  var statueBody = new Cube(); // Creating the body as a small rectangle
  if (g_normalOn === true) {
    statueBody.textureNum = -3; // Use the normals on the body
  } else {
    statueBody.textureNum = 1; // Use the texture1 on the body
  }
  statueBody.matrix.translate(-0.25, -0.15, 0.0); // X and Y placements for the body
  statueBody.matrix.scale(0.3, 0.65, 0.65); // Scaling for the body
  statueBody.render(); // Rendering for the body
  
  // Draw the statue's arm cube
  var statueArm = new Cube(); // Creating the arm as a small rectangle
  statueArm.color = [1, 1, 0, 1]; // Color the arm yellow
  if (g_normalOn === true) {
    statueArm.textureNum = -3; // Use the normals on the arm
  } else {
    statueArm.textureNum = -2; // Use the colors on the arm
  }
  statueArm.matrix.translate(-0.15, 0.3, 0); // X and Y placements for the arm
  statueArm.matrix.scale(1.15, 0.1, 1.15); // Scaling for the arm
  statueArm.render(); // Rendering for the arm

  // Draw the body cube
  var body = new Cube(); // Creating the body as a large rectangle
  body.color = [0.752, 0.752, 0.752, 1]; // Coloring the body silver
  if (g_normalOn === true) {
    body.textureNum = -3; // Use the normals on the body
  } else {
    body.textureNum = -2; // Use the colors on the body
  }
  body.matrix.translate(-0.25 + 0.5, -0.025 + 0.85, 0.0); // X and Y placements for the body
  // body.matrix.translate(-0.25 - 24, -0.025 + 4.5, 0 - 24); // X and Y placements for the body
  body.matrix.rotate(-5, 1, 0, 0); // Set rotation for the body
  body.matrix.scale(0.7, 0.5, 0.7); // Scaling for the body
  body.render(); // Rendering for the body

  // Draw a front-left leg's thigh
  var frontLeftLegThigh = new Cube(); // Creating the front-left leg's thigh as a small rectangle
  if (g_normalOn === true) {
    frontLeftLegThigh.textureNum = -3; // Use the normals on the front-left leg's thigh
  } else {
    frontLeftLegThigh.textureNum = -2; // Use the colors on the front-left leg's thigh
  }
  frontLeftLegThigh.color = [0.662, 0.662, 0.662, 1]; // Coloring it dark gray
  frontLeftLegThigh.matrix.setTranslate(-0.12 + 0.5, 0 + 0.85, 0.0); // X, Y, and Z placement for the whole front-left leg
  // frontLeftLegThigh.matrix.setTranslate(-0.12 - 25, 0 + 5, 0 - 25); // X, Y, and Z placement for the whole front-left leg
  frontLeftLegThigh.matrix.rotate(-5, 1, 0, 0); // Rotation for the whole front-left leg
  frontLeftLegThigh.matrix.rotate(-g_frontLeftLegThighAngle, 0, 0); // Setting the animation rotation for the whole front-left leg
  frontLeftLegThigh.matrix.scale(0.5, -0.5, 0.5); // Flipping the whole front-left leg vertically and scaling it by 1/2th
  var frontLeftLegThighCoordinatesMat = new Matrix4(frontLeftLegThigh.matrix); // Setting the coordinate system for the whole left leg to be the front-left leg's thigh
  frontLeftLegThigh.matrix.scale(0.25, 0.75, 0.25); // Setting the custom 1/4th, 3/4th, 1/4th scale for the front-left leg's thigh
  frontLeftLegThigh.matrix.translate(-0.5, 0, 0); // Setting the custom X placement for the front-left leg's thigh
  frontLeftLegThigh.normalMatrix = normalMat; // Setting the normal matrix for the front-left leg's thigh
  frontLeftLegThigh.render(); // Rendering the front-left leg's thigh

  // Draw a front-left leg's paw
  var frontLeftLegPaw = new Cube(); // Creating the front-left leg's paw as a small rectangle
  if (g_normalOn === true) {
    frontLeftLegPaw.textureNum = -3; // Use the normals on the front-left leg's paw
  } else {
    frontLeftLegPaw.textureNum = -2; // Use the colors on the front-left leg's paw
  }
  frontLeftLegPaw.color = [0.5, 0.25, 0.1, 1]; // Coloring the front-left leg's paw as brown because black would be too hard to see
  frontLeftLegPaw.matrix = frontLeftLegThighCoordinatesMat; // Setting the coordinate system for the whole front-left leg to be the front-left leg's thigh
  frontLeftLegPaw.matrix.translate(0, 0.65, 0); // Setting the custom Y placement for the front-left leg's paw
  frontLeftLegPaw.matrix.rotate(-g_frontLeftLegPawAngle, 0, 0, 1); // Setting the animation rotation for the whole front-left leg
  frontLeftLegPaw.matrix.scale(0.20, 0.25, 0.20); // Setting the custom 1/5th, 1/4th, 1/5th scale for the front-left leg's paw
  frontLeftLegPaw.matrix.translate(-0.5, 0.45, -0.001); // Setting the custom X, Y, and Z (to avoid z-buffering) placement for the front-left leg's paw
  frontLeftLegPaw.normalMatrix = normalMat; // Setting the normal matrix for the front-left leg's paw
  frontLeftLegPaw.render(); // Rendering the front-left leg's paw

  // Draw a front-right leg's thigh
  var frontRightLegThigh = new Cube(); // Creating the front-right leg's thigh as a small rectangle
  if (g_normalOn === true) {
    frontRightLegThigh.textureNum = -3; // Use the normals on the front-right leg's thigh
  } else {
    frontRightLegThigh.textureNum = -2; // Use the colors on the front-right leg's thigh
  }
  frontRightLegThigh.color = [0.662, 0.662, 0.662, 1]; // Coloring it dark gray
  frontRightLegThigh.matrix.setTranslate(-0.12 + 0.5, 0 + 0.85, 0.5); // X, Y, and Z placement for the whole front-right leg
  // frontRightLegThigh.matrix.setTranslate(-0.12 - 24.5, 0 + 4.5, 0.5 - 24.5); // X, Y, and Z placement for the whole front-right leg
  frontRightLegThigh.matrix.rotate(-5, 1, 0, 0); // Rotation for the whole left leg
  frontRightLegThigh.matrix.rotate(-g_frontRightLegThighAngle, 0, 0); // Setting the animation rotation for the whole front-right leg
  frontRightLegThigh.matrix.scale(0.5, -0.5, 0.5); // Flipping the whole front-right leg vertically and scaling it by 1/2th
  var frontRightLegThighCoordinatesMat = new Matrix4(frontRightLegThigh.matrix); // Setting the coordinate system for the whole front-right leg to be the front-right leg's thigh
  frontRightLegThigh.matrix.scale(0.25, 0.75, 0.25); // Setting the custom 1/4th, 3/4th, 1/4th scale for the front-right leg's thigh
  frontRightLegThigh.matrix.translate(-0.5, 0, 0); // Setting the custom X placement for the front-right leg's thigh
  frontRightLegThigh.normalMatrix = normalMat; // Setting the normal matrix for the front-right leg's thigh
  frontRightLegThigh.render(); // Rendering the front-right leg's thigh

  // Draw a front-right leg's paw
  var frontRightLegPaw = new Cube(); // Creating the front-right leg's paw as a small rectangle
  if (g_normalOn === true) {
    frontRightLegPaw.textureNum = -3; // Use the normals on the front-right leg's paw
  } else {
    frontRightLegPaw.textureNum = -2; // Use the colors on the front-right leg's paw
  }
  frontRightLegPaw.color = [0.5, 0.25, 0.1, 1]; // Coloring the front-right leg's paw as brown because black would be too hard to see
  frontRightLegPaw.matrix = frontRightLegThighCoordinatesMat; // Setting the coordinate system for the whole front-right leg to be the front-right leg's thigh
  frontRightLegPaw.matrix.translate(0, 0.65, 0); // Setting the custom Y placement for the front-right leg's paw
  frontRightLegPaw.matrix.rotate(-g_frontRightLegPawAngle, 0, 0, 1); // Setting the animation rotation for the whole front-right leg
  frontRightLegPaw.matrix.scale(0.20, 0.25, 0.20); // Setting the custom 1/5th, 1/4th, 1/5th scale for the front-right leg's paw
  frontRightLegPaw.matrix.translate(-0.5, 0.45, -0.001); // Setting the custom X, Y, and Z (to avoid z-buffering) placement for the front-right leg's paw
  frontRightLegPaw.normalMatrix = normalMat; // Setting the normal matrix for the front-right leg's paw
  frontRightLegPaw.render(); // Rendering the front-right leg's paw

  // Draw a back-left leg's thigh
  var backLeftLegThigh = new Cube(); // Creating the back-left leg's thigh as a small rectangle
  if (g_normalOn === true) {
    backLeftLegThigh.textureNum = -3; // Use the normals on the back-left leg's thigh
  } else {
    backLeftLegThigh.textureNum = -2; // Use the colors on the back-left leg's thigh
  }
  backLeftLegThigh.color = [0.662, 0.662, 0.662, 1]; // Coloring it dark gray
  backLeftLegThigh.matrix.setTranslate(0.25 + 0.5, 0 + 0.85, 0.0); // X, Y, and Z placement for the whole back-left leg
  // backLeftLegThigh.matrix.setTranslate(0.25 - 24.5, 0 + 4.5, 0 - 24.5); // X, Y, and Z placement for the whole back-left leg
  backLeftLegThigh.matrix.rotate(-5, 1, 0, 0); // Rotation for the whole back-left leg
  backLeftLegThigh.matrix.rotate(-g_backLeftLegThighAngle, 0, 0); // Setting the animation rotation for the whole back-left leg
  backLeftLegThigh.matrix.scale(0.5, -0.5, 0.5); // Flipping the whole back-left leg vertically and scaling it by 1/2th
  var backLeftLegThighCoordinatesMat = new Matrix4(backLeftLegThigh.matrix); // Setting the coordinate system for the whole back-left leg to be the back-left leg's thigh
  backLeftLegThigh.matrix.scale(0.25, 0.75, 0.25); // Setting the custom 1/4th, 3/4th, 1/4th scale for the back-left leg's thigh
  backLeftLegThigh.matrix.translate(-0.5, 0, 0); // Setting the custom X placement for the back-left leg's thigh
  backLeftLegThigh.normalMatrix = normalMat; // Setting the normal matrix for the back-left leg's thigh
  backLeftLegThigh.render(); // Rendering the back-left leg's thigh

  // Draw a back-left leg's paw
  var backLeftLegPaw = new Cube(); // Creating the back-left leg's paw as a small rectangle
  if (g_normalOn === true) {
    backLeftLegPaw.textureNum = -3; // Use the normals on the back-left leg's paw
  } else {
    backLeftLegPaw.textureNum = -2; // Use the colors on the back-left leg's paw
  }
  backLeftLegPaw.color = [0.5, 0.25, 0.1, 1]; // Coloring the back-left leg's paw as brown because black would be too hard to see
  backLeftLegPaw.matrix = backLeftLegThighCoordinatesMat; // Setting the coordinate system for the whole back-left leg to be the front-left leg's thigh
  backLeftLegPaw.matrix.translate(0, 0.65, 0); // Setting the custom Y placement for the back-left leg's paw
  backLeftLegPaw.matrix.rotate(-g_backLeftLegPawAngle, 0, 0, 1); // Setting the animation rotation for the whole back-left leg
  backLeftLegPaw.matrix.scale(0.20, 0.25, 0.20); // Setting the custom 1/5th, 1/4th, 1/5th scale for the back-left leg's paw
  backLeftLegPaw.matrix.translate(-0.5, 0.45, -0.001); // Setting the custom X, Y, and Z (to avoid z-buffering) placement for the back-left leg's paw
  backLeftLegPaw.normalMatrix = normalMat; // Setting the normal matrix for the back-left leg's paw
  backLeftLegPaw.render(); // Rendering the back-left leg's paw

  // Draw a back-right leg's thigh
  var backRightLegThigh = new Cube(); // Creating the back-right leg's thigh as a small rectangle
  if (g_normalOn === true) {
    backRightLegThigh.textureNum = -3; // Use the normals on the back-right leg's thigh
  } else {
    backRightLegThigh.textureNum = -2; // Use the colors on the back-right leg's thigh
  }
  backRightLegThigh.color = [0.662, 0.662, 0.662, 1]; // Coloring it dark gray
  backRightLegThigh.matrix.setTranslate(0.25 + 0.5, 0 + 0.85, 0.5); // X, Y, and Z placement for the whole back-right leg
  // backRightLegThigh.matrix.setTranslate(0.25 - 24.5, 0 + 4.5, 0.5 - 24.5); // X, Y, and Z placement for the whole back-right leg
  backRightLegThigh.matrix.rotate(-5, 1, 0, 0); // Rotation for the whole left leg
  backRightLegThigh.matrix.rotate(-g_backRightLegThighAngle, 0, 0); // Setting the animation rotation for the whole back-right leg
  backRightLegThigh.matrix.scale(0.5, -0.5, 0.5); // Flipping the whole back-right leg vertically and scaling it by 1/2th
  var backRightLegThighCoordinatesMat = new Matrix4(backRightLegThigh.matrix); // Setting the coordinate system for the whole front-right leg to be the back-right leg's thigh
  backRightLegThigh.matrix.scale(0.25, 0.75, 0.25); // Setting the custom 1/4th, 3/4th, 1/4th scale for the back-right leg's thigh
  backRightLegThigh.matrix.translate(-0.5, 0, 0); // Setting the custom X placement for the back-right leg's thigh
  backRightLegThigh.normalMatrix = normalMat; // Setting the normal matrix for the back-right leg's thigh
  backRightLegThigh.render(); // Rendering the back-right leg's thigh

  // Draw a back-right leg's paw
  var backRightLegPaw = new Cube(); // Creating the back-right leg's paw as a small rectangle
  if (g_normalOn === true) {
    backRightLegPaw.textureNum = -3; // Use the normals on the back-right leg's paw
  } else {
    backRightLegPaw.textureNum = -2; // Use the colors on the back-right leg's paw
  }
  backRightLegPaw.color = [0.5, 0.25, 0.1, 1]; // Coloring the back-right leg's paw as brown because black would be too hard to see
  backRightLegPaw.matrix = backRightLegThighCoordinatesMat; // Setting the coordinate system for the whole back-right leg to be the back-right leg's thigh
  backRightLegPaw.matrix.translate(0, 0.65, 0); // Setting the custom Y placement for the back-right leg's paw
  backRightLegPaw.matrix.rotate(-g_backRightLegPawAngle, 0, 0, 1); // Setting the animation rotation for the whole back-right leg
  backRightLegPaw.matrix.scale(0.20, 0.25, 0.20); // Setting the custom 1/5th, 1/4th, 1/5th scale for the back-right leg's paw
  backRightLegPaw.matrix.translate(-0.5, 0.45, -0.001); // Setting the custom X, Y, and Z (to avoid z-buffering) placement for the back-right leg's paw
  backRightLegPaw.normalMatrix = normalMat; // Setting the normal matrix for the back-right leg's paw
  backRightLegPaw.render(); // Rendering the back-right leg's paw

  // Draw a crown
  var crown = new Prism();
  if (g_normalOn === true) {
    crown.textureNum = -3; // Use the normals on the crown
  } else {
    crown.textureNum = -2; // Use the colors on the crown
  }
  crown.color = [1, 0.843, 0, 1]; // Coloring the crown gold
  crown.matrix.translate(-0.5 + 0.5, 0.75 + 0.85, 0.15); // Setting the crown's placement on the top of the head
  // crown.matrix.translate(-0.5 - 24.5, 0.75 + 4.5, 0.15 - 24.5); // Setting the crown's placement on the top of the head
  crown.matrix.scale(0.5, 0.25, 0.25); // Scaling the crown
  crown.render(); // Rendering the crown

  // Draw a head
  var head = new Cube();
  if (g_normalOn === true) {
    head.textureNum = -3; // Use the normals on the head
  } else {
    head.textureNum = -2; // Use the colors on the head
  }
  head.color = [0.827, 0.827, 0.827, 1]; // Coloring the head light gray
  head.matrix.translate(-0.5 + 0.5, 0.5 + 0.85, 0.15); // Setting the head's placement at the top of the body
  // head.matrix.translate(-0.5 - 24.5, 0.5 + 4.5, 0.15 - 24.5); // Setting the head's placement at the top of the body
  head.matrix.scale(0.25, 0.25, 0.25); // Scaling the crown
  head.render();

  // Draw a tail
  var tail = new Cube(); // Creating the bottom tail as a small rectangle
  if (g_normalOn === true) {
    tail.textureNum = -3; // Use the normals on the tail
  } else {
    tail.textureNum = -2; // Use the colors on the tail
  }
  tail.color = [0.662, 0.662, 0.662, 1]; // Coloring it dark gray
  tail.matrix.translate(0.45 + 0.5, 0.5 + 0.85, 0.15); // X, Y, and Z placement for the tail
  // tail.matrix.translate(0.45 - 24.5, 0.5 + 4.5, 0.15 - 24.5); // X, Y, and Z placement for the tail
  tail.matrix.rotate(-0.75, 1, 0, 0); // Rotation for the tail
  tail.matrix.rotate(-g_tailAngle, 0, 0); // Setting the animation rotation for the tail
  tail.matrix.scale(0.2, 0.4, 0.2); // Flipping the tail vertically and scaling it by a 1/5th, 2/5th, 1/5th scale
  tail.normalMatrix = normalMat; // Setting the normal matrix for the tail
  tail.render(); // Rendering the bottom tail

  // Check the time at the end of the function, and show on web page
  var duration = performance.now() - startTime;
  sendTextToHTML(" ms: " + Math.floor(duration) + " fps: " + Math.floor(10000 / duration), "numdot");
}


// Set the text of a HTML element
function sendTextToHTML(text, htmlID) {
  var htmlElm = document.getElementById(htmlID);
  if (!htmlElm) {
    console.log("Failed to get: " + htmlID + " from HTML");
    return;
  }
  htmlElm.innerHTML = text;
}