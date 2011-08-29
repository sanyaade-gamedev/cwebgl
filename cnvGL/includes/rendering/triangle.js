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

cnvgl_renderer_triangle = function() {

	//Internal Constructor
	function Initializer() {
	}

	var cnvgl_renderer_triangle = jClass('cnvgl_renderer_triangle', Initializer);

	//static:

	cnvgl_renderer_triangle.Constructor.triangles = function(vertices) {
		var i, prim;
		
		for (i = 0; i < vertices.length - 2; i+=3) {

			prim = new cnvgl_primitive();
			prim.vertices[0] = vertices[i];
			prim.vertices[1] = vertices[i + 1];
			prim.vertices[2] = vertices[i + 2];

			this.clipping.clip(prim);

			this.Triangle.triangle.call(this, prim);
		}
	};

	cnvgl_renderer_triangle.Constructor.triangleStrip = function(vertices) {
		var i, prim;
		for (i = 0; i < vertices.length - 2; i++) {

			prim = new cnvgl_primitive();
			prim.vertices[0] = vertices[i];
			prim.vertices[1] = vertices[i + 1];
			prim.vertices[2] = vertices[i + 2];

			this.clipping.clip(prim);

			this.Triangle.triangle.call(this, prim);
		}
	};

	cnvgl_renderer_triangle.Constructor.triangle = function(prim) {

		var frag, varying;
		var v1, v2, v3, dir;
		var yi_start, yi_end, yi, x_start, x_end, vpass = false;
		var dx1, dx2, dx3;

		if (this.checkCull(prim)) {
			return;
		}

		//prepare (sort) vertices
		this.vertex.sortVertices(prim);
		dir = prim.getDirection();

		v1 = prim.vertices[0];
		if (dir < 0) {
			v2 = prim.vertices[1];
			v3 = prim.vertices[2];
		} else {
			v2 = prim.vertices[2];
			v3 = prim.vertices[1];		
		}

		this.t.frag = new cnvgl_fragment();
		this.t.varying = new cnvgl_rendering_varying(v1, v2, v3);
		this.t.vertex_z = [v1.z, v2.z, v3.z];

		dx1 = this.vertex.slopeX(v1.sx, v1.sy, v2.sx, v2.sy);
		dx2 = this.vertex.slopeX(v1.sx, v1.sy, v3.sx, v3.sy);
		dx3 = this.vertex.slopeX(v2.sx, v2.sy, v3.sx, v3.sy);

		//top and bottom bounds
		yi_start = Math.floor(v1.sy) + .5;
		if (yi_start < v1.sy) {
			yi_start++;
		}
		if (v3.sy > v2.sy) {
			yi = v3.sy;
		} else {
			yi = v2.sy;
		}
		yi_end = Math.ceil(yi) - .5;
		if (yi_end >= yi) {
			yi_end--;
		}

		x_start = v1.sx + (yi_start - v1.sy) * dx1;
		x_end = v1.sx + (yi_start - v1.sy) * dx2;

		//for each horizontal scanline
		for (yi = yi_start; yi < yi_end; yi++) {

			//next vertex (v1, v2) -> (v2, v3)
			if (!vpass && yi > v2.sy) {
				x_start = v3.sx + (yi - v3.sy) * dx3;
				dx1 = dx3;
				vpass = true;
			}

			//next vertex (v1, v3) -> (v2, v3)
			if (!vpass && yi > v3.sy) {
				x_end = v3.sx + (yi - v3.sy) * dx3;
				dx2 = dx3;
				vpass = true;
			}

			this.Triangle.scanline.call(this, yi, x_start, x_end);

			x_start += dx1;
			x_end += dx2;
		}
	};

	cnvgl_renderer_triangle.Constructor.scanline = function(yi, x_start, x_end) {
		var color_buffer, depth_buffer, varying, frag;
		var id, ib, point;
		var xi_start, xi_end, xi;
		
		color_buffer = this.state.color_buffer;
		depth_buffer = this.state.depth_buffer;
		frag = this.t.frag;
		varying = this.t.varying;

		//left and right bounds
		xi_start = Math.floor(x_start) + .5;
		if (xi_start < x_start) {
			xi_start++;	
		}
		xi_end = Math.ceil(x_end) - .5;
		if (xi_end >= x_end) {
			xi_end--;	
		}

		id = this.state.viewport_w * (yi - .5) + (xi_start - .5);
		ib = id * 4;

		for (xi = xi_start; xi <= xi_end; xi++) {

			point = [xi, yi, 0, 1];
			varying.prepare(frag, point);

			if (this.state.depth.test) {
				frag.gl_FragDepth = varying.interpolate(this.t.vertex_z[0], this.t.vertex_z[1], this.t.vertex_z[2]);
				if (frag.gl_FragDepth < depth_buffer[id]) {
					continue;
				}
				depth_buffer[id] = frag.gl_FragDepth;
				id++;
			}

			//interpolate varying
			for (v in varying.varying) {
				frag.varying[v] = varying.interpolate(varying.f1[v], varying.f2[v], varying.f3[v]);
			}

			this.fragment.process(frag);

			color_buffer[ib] = frag.r;
			color_buffer[ib + 1] = frag.g;
			color_buffer[ib + 2] = frag.b;
			ib += 4;
		}		
	};

	//public:
	cnvgl_renderer_triangle.cnvgl_renderer_triangle = function() {
	};

	return cnvgl_renderer_triangle.Constructor;
};

