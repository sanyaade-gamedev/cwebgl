/*
Copyright (c) 2011 Cimaron Shanahan

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


cWebGL.drivers.cnvGL = (function() {

	function Initializer() {
		cWebGL.Driver.Initializer.apply(this);
		
		this.queue = null;

		this.colorBuffer = null;
		this.depthBuffer = null;
		this.stencilBuffer = null;

		this.width = null;
		this.height = null;
		
		this._context = null;
		this._context2d = null;
	}

	var DriverCnvGL = jClass('DriverCnvGL', Initializer, cWebGL.Driver);

	//static:

	DriverCnvGL.Static.test = function() {
		return true;
	};
	
	DriverCnvGL.Static.animationFrameQueue = [];

	DriverCnvGL.Static.animationFrameFunc = true;

	DriverCnvGL.Static.requestAnimationFrameNative = null;
	DriverCnvGL.Static.requestAnimationFrame = function(func, el) {
		DriverCnvGL.Static.animationFrameQueue.push(func);
	};
	DriverCnvGL.Static.requestAnimationFrameWrapper = function(func, el) {
		DriverCnvGL.Static.animationFrameFunc.call(window, func, el);
	};

	DriverCnvGL.Static.setupRequestAnimationFrame = function() {
		DriverCnvGL.Static.requestAnimationFrameNative =
			window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			window.oRequestAnimationFrame ||
			window.msRequestAnimationFrame ||
			function(func, el) {
				window.setTimeout(el, 1000 / 60);
			};

		DriverCnvGL.Static.animationFrameFunc = DriverCnvGL.Static.requestAnimationFrameNative;
		window.requestAnimationFrame = DriverCnvGL.Static.requestAnimationFrameWrapper;
	};

	DriverCnvGL.Static.frameComplete = function() {
		var list;
		list = DriverCnvGL.Static.animationFrameQueue;
		while (list.length > 0) {
			window.setTimeout(list.shift(), 0);
		}
	};

	DriverCnvGL.Static.setupRequestAnimationFrame();


	//public:

	DriverCnvGL.DriverCnvGL = function(canvas, config) {
		this.Driver(canvas, config);

		if (this._context2d = canvas.getContext('2d', null, true)) {

			this.ready = true;
			this.width = canvas.width;
			this.height = canvas.height;

			this.colorBuffer = this._context2d.createImageData(this.width, this.height);
			this.depthBuffer = cnvgl.malloc(this.width * this.height, 1, Float32Array);
			this.stencilBuffer = cnvgl.malloc(this.width * this.height, 1, Uint8Array);

			if (!GPU.renderer) {
				GPU.renderer = new cnvgl_renderer();
			}
			this.queue = new GPU.CommandQueue(this);
			this._context = new GPU.Context();

			this.command('set', 'colorBuffer', this.colorBuffer);
			this.command('set', 'depthBuffer', this.depthBuffer);
			this.command('set', 'stencilBuffer', this.stencilBuffer);

			DriverCnvGL.Static.animationFrameFunc = DriverCnvGL.Static.requestAnimationFrame;
		}
		//need to add failure code
	};
	
	DriverCnvGL.command = function() {
		var args;
		args = [].slice.call(arguments, 0);
		args.unshift(this._context);
		this.queue.enqueue(args);
	};

	DriverCnvGL.bindTexture = function(ctx, unit, target, tex_obj) {
		this.command('uploadTexture', unit, tex_obj);
	};

	DriverCnvGL.blendColor = function(ctx, r, g, b, a) {
		this.command('set', 'blendColor', [r, g, b, a]);
	};

	DriverCnvGL.blendFunc = function(ctx, sfactor, dfactor) {
		this.command('set', 'blendSrcA', sfactor);
		this.command('set', 'blendSrcRGB', sfactor);
		this.command('set', 'blendDestA', dfactor);
		this.command('set', 'blendDestRGB', dfactor);
	};

	DriverCnvGL.clear = function(ctx, color, depth, stencil, mask) {
		if (mask && cnvgl.COLOR_BUFFER_BIT) {
			this.command('set', 'clearColor', color);
		}
		if (mask && cnvgl.DEPTH_BUFFER_BIT) {
			this.command('set', 'clearDepth', depth);
		}
		if (mask && cnvgl.STENCIL_BUFFER_BIT) {
			this.command('set', 'clearStencil', stencil);
		}
		this.command('clear', mask);
	};

	DriverCnvGL.colorMask = function(ctx, r, g, b, a) {
		this.command('set', 'colorMask', [r, g, b, a]);
	};

	DriverCnvGL.compileShader = function(ctx, shader, source, type) {

		var options, state;
		
		options = {};

		switch (type) {
			case cnvgl.FRAGMENT_SHADER:
				options.target = glsl.target.fragment;
				break;
			case cnvgl.VERTEX_SHADER:
				options.target = glsl.target.vertex;
				break;
		}

		state = glsl.compile(source, options);

		this.compileStatus = state.status;
		this.compileLog = state.errors.join("\n");

		if (this.compileStatus) {
			shader.out = state;
		}
	};

	DriverCnvGL.cullFace = function(ctx, mode) {
		this.command('set', 'cullFaceMode', mode);
	};

	DriverCnvGL.createProgram = function() {
		var program;
		program = new cWebGL.Driver.Program();
		return program;
	};

	DriverCnvGL.createShader = function(ctx, type) {
		return {};
	};

	DriverCnvGL.depthRange = function(ctx, n, f) {
		this.command('set', 'viewportN', n);
		this.command('set', 'viewportF', f);
	};

	DriverCnvGL.depthFunc = function(ctx, func) {
		this.command('set', 'depthFunc', func);
	};

	DriverCnvGL.depthMask = function(ctx, mask) {
		this.command('set', 'depthMask', mask);
	};

	DriverCnvGL.disableVertexAttribArray = function(ctx, index) {

	};

	DriverCnvGL.drawArrays = function(ctx, mode, first, count) {
		this.command('drawPrimitives', mode, first, count);
	};

	DriverCnvGL.drawElements = function(ctx, mode, first, count, type) {
		var buffer;
		buffer = ctx.array.elementArrayBufferObj.data;
		this.command('drawIndexedPrimitives', mode, buffer, first, count, type);
	};

	DriverCnvGL.enable = function(ctx, flag, v) {
		switch (flag) {
			case cnvgl.BLEND:
				this.command('set', 'blendEnabled', v);
				break;
			case cnvgl.CULL_FACE:
				this.command('set', 'cullFlag', v);
				break;
			case cnvgl.DEPTH_TEST:
				this.command('set', 'depthTest', v);
				break;
			case cnvgl.DITHER:
				break;
			case cnvgl.SCISSOR_TEST:
				this.command('set', 'scissorTest', v);
				break;
			default:
				console.log(flag);
		}
	};

	DriverCnvGL.enableVertexAttribArray = function(ctx, index) {

	};

	DriverCnvGL.flush = function(ctx, mode) {
	};

	DriverCnvGL.frontFace = function(ctx, mode) {
		this.command('set', 'cullFrontFace', mode);
	};

	DriverCnvGL.link = function(ctx, program, shaders) {

		var i, code, prgm;
		
		prgm = new glsl.program();

		for (i = 0; i < shaders.length; i++) {
			code = shaders[i].out.getIR();
			prgm.addObjectCode(code, shaders[i].out.options.target);
		}

		if (prgm.error) {
		
			this.linkStatus = false;
			this.linkLog = prgm.error.join("\n");
			this.logError(this.program.error);

			return;
		}

		this.linkStatus = true;
		this.linkLog = "";

		prgm.setTexFunction(GPU.tex);		
		prgm.build();

		/*
		var sh, j, unif, varying;
		*/

		program.exec = prgm;

		program.attributes = prgm.symbols.attribute;
		program.uniforms = prgm.symbols.uniform;
		program.varying = prgm.symbols.varying;

		var varying;
		varying = new Array(GPU.shader.MAX_VARYING_VECTORS);

		for (i in program.varying) {
			for (j = 0; j < program.varying[i].slots; j++) {
				varying[program.varying[i].pos + j] = program.varying[i].components;
			}
		}

		for (i = 0; i < varying.length; i++) {
			this.command('setArray', 'activeVarying', i, varying[i] || 0);
		}
	};

	DriverCnvGL.polygonOffset = function(ctx, factor, units) {
		this.command('set', 'polygonOffsetFactor', factor);
		this.command('set', 'polygonOffsetUnits', units);
	};

	DriverCnvGL.present = function() {
		this._context2d.putImageData(this.colorBuffer, 0, 0);
		DriverCnvGL.Static.frameComplete();
	};

	DriverCnvGL.renderTexture = function(ctx, fb_obj, tex_obj, textarget, level, offset) {
		this.command('renderTexture', fb_obj, tex_obj, textarget, level, offset);
	};

	DriverCnvGL.sampleCoverage = function(ctx, value, invert) {
		this.command('set', 'mulitsampleCoverageValue', value);
		this.command('set', 'mulitsampleCoverageInvert', invert);
	};

	DriverCnvGL.stencilFunc = function(ctx, func, ref, mask) {
		this.command('set', 'stencilFuncFront', func);
		this.command('set', 'stencilFuncBack', func);
		this.command('set', 'stencilRefFront', ref);
		this.command('set', 'stencilRefBack', ref);
		this.command('set', 'stencilValueMaskFront', mask);
		this.command('set', 'stencilValueMaskBack', mask);
	};

	DriverCnvGL.stencilOp = function(ctx, sfail, dpfail, dppass) {
		this.command('set', 'stencilFailFuncBack', sfail);
		this.command('set', 'stencilFailFuncFront', sfail);
		this.command('set', 'stencilZFailFuncBack', dpfail);
		this.command('set', 'stencilZFailFuncFront', dpfail);
		this.command('set', 'stencilZPassFuncBack', dppass);
		this.command('set', 'stencilZPassFuncFront', dppass);
	};

	DriverCnvGL.stencilMask = function(ctx, mask) {
		this.command('set', 'stencilWriteMaskFront', mask);
		this.command('set', 'stencilWriteMaskBack', mask);
	};

	DriverCnvGL.scissor = function(ctx, x, y, width, height) {
		this.command('set', 'scissorX', x);
		this.command('set', 'scissorY', y);
		this.command('set', 'scissorWidth', width);
		this.command('set', 'scissorHeight', height);
	};

	DriverCnvGL.uploadAttributes = function(ctx, location, size, stride, pointer, data) {
		this.command('uploadAttributes', location, size, stride, pointer, data);
	};

	DriverCnvGL.uploadUniform = function(ctx, location, data, slots, components) {
		this.command('uploadUniforms', location, data, slots, components);
	};

	DriverCnvGL.useProgram = function(ctx, program) {
		this.command('uploadProgram', program.exec);
	};

	DriverCnvGL.texImage2D = function(ctx, target, unit, tex_obj) {
	};

	DriverCnvGL.viewport = function(ctx, x, y, w, h) {
		this.command('set', 'viewportX', x);
		this.command('set', 'viewportY', y);
		this.command('set', 'viewportW', w);
		this.command('set', 'viewportH', h);
	};

	return DriverCnvGL.Constructor;

}());


include('external/jsgpu/gpu.js');

