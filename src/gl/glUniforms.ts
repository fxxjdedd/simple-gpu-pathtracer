// https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getActiveUniform

import { Texture } from "../core/texture";
import { GL_State } from "./glState";
import { GL_Textures } from "./glTextures";

export class GL_Uniforms {
    map: Record<string, UniformWrapper> = {};
    list: UniformWrapper[] = [];

    appendUniform(info: WebGLActiveInfo, addr: WebGLUniformLocation) {
        const namePath = info.name;

        let matches;

        if ((matches = namePath.match(/(\w+)\.(\w+)$/))) {
            const [_, id, field] = matches;
            const h = (this.map[id] || new GL_HierarchyUniformStructure(id)) as GL_HierarchyUniformStructure;
            const u = new GL_BareUniform(field, info, addr);
            h.map[field] = u;
            h.list.push(u);
            if (this.map[id] !== h) {
                this.map[id] = h;
                this.list.push(h);
            }
        } else if ((matches = namePath.match(/(\w+)\[(\d+)\]$/))) {
            const [_, id, index] = matches;
            const h = (this.map[id] || new GL_HierarchyUniformStructure(id)) as GL_HierarchyUniformStructure;
            const u = new GL_SimpleArrayUniform(+index, info, addr);
            h.map[+index] = u;
            h.list.push(u);
            if (this.map[id] !== h) {
                this.map[id] = h;
                this.list.push(h);
            }
        } else if ((matches = namePath.match(/(\w+)$/))) {
            const [_, id] = matches;
            const u = new GL_BareUniform(id, info, addr);
            this.map[id] = u;
            this.list.push(u);
        }

        // todo: struct array
    }
}

interface UniformWrapper {
    setValue(gl: WebGL2RenderingContext, v: any, textures?: GL_Textures): void;
}

// uniform vec4 a;
// a
class GL_BareUniform implements UniformWrapper {
    constructor(public name, public info, public addr) {}

    setValue(gl: WebGL2RenderingContext, v, v2) {
        const setter = getUniformFunction(gl, this.info.type);
        setter.call(gl, this.addr, v, v2);
    }
}

// uniform vec4 b[3];
// b[0]
// b[1]
// b[2]
export class GL_SimpleArrayUniform implements UniformWrapper {
    constructor(public index, public info, public addr) {}

    setValue(gl: WebGL2RenderingContext, v) {
        const setter = getUniformFunction(gl, this.info.type);
        setter.call(gl, v);
    }
}

// uniform struct {
//     float foo;
//     vec4 bar;
// } c;
// c.foo
// c.bar

// uniform struct {
//     float foo;
//     vec4 bar;
// } d[2];
// d[0].foo
// d[0].bar
// d[1].foo
// d[1].bar

// uniform Block {
//     float bar;
// } e;
// e.bar
export class GL_HierarchyUniformStructure implements UniformWrapper {
    map: Record<string, UniformWrapper> = {};
    list: UniformWrapper[] = [];
    constructor(public id) {}

    setValue(gl: WebGL2RenderingContext, v: any): void {
        for (const key of Object.keys(v)) {
            const uniform = this.map[key];

            if (uniform == undefined) {
                throw new Error("Missing required glsl struct field: " + key);
            }

            uniform.setValue(gl, v[key]);
        }
    }
}

// uniform Block {
//     vec4 a;
// };
// a
// ???
function getUniformFunction(gl, type) {
    switch (type) {
        case gl.FLOAT:
            return gl.uniform1f;
        case gl.FLOAT_VEC2:
            return gl.uniform2fv;
        case gl.FLOAT_VEC3:
            return gl.uniform3fv;
        case gl.FLOAT_VEC4:
            return gl.uniform4fv;
        case gl.INT:
            return gl.uniform1i;
        case gl.INT_VEC2:
            return gl.uniform2iv;
        case gl.INT_VEC3:
            return gl.uniform3iv;
        case gl.INT_VEC4:
            return gl.uniform4iv;
        case gl.BOOL:
            return gl.uniform1i;
        case gl.BOOL_VEC2:
            return gl.uniform2iv;
        case gl.BOOL_VEC3:
            return gl.uniform3iv;
        case gl.BOOL_VEC4:
            return gl.uniform4iv;
        case gl.FLOAT_MAT2:
            return function (addr, v) {
                gl.uniformMatrix2fv(addr, false, v);
            };
        case gl.FLOAT_MAT3:
            return function (addr, v) {
                gl.uniformMatrix3fv(addr, false, v);
            };
        case gl.FLOAT_MAT4:
            return function (addr, v) {
                gl.uniformMatrix4fv(addr, false, v);
            };
        case gl.SAMPLER_2D:
            return function (addr, texture: Texture, textures: GL_Textures) {
                const unit = textures.allocTextureUnit(texture);
                gl.uniform1i(addr, unit);
                textures.uploadTexture(texture, unit);
            };
        case gl.SAMPLER_CUBE:
            return function (addr, texture: Texture, textures: GL_Textures) {
                const unit = textures.allocTextureUnit(texture);
                gl.uniform1i(addr, unit);
                textures.uploadTexture(texture, unit);
            };
        default:
            throw new Error(`Unsupported uniform type: ${type}`);
    }
}
