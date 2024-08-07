export const vertex = /* glsl */ `#version 300 es
	precision highp float;
	#pragma vscode_glsllint_stage : vert //pragma to set STAGE to 'vert'

	in vec3 position;
	in vec2 uv;

	uniform mat4 projMatrix;
	uniform mat4 mvMatrix;

	out vec2 v_uv;

	void main() {
		gl_Position = projMatrix * mvMatrix * vec4(position, 1.0);
		v_uv = uv;
	}
`;

export const fragment = /* glsl */ `#version 300 es
	precision highp float;
	#pragma vscode_glsllint_stage : frag //pragma to set STAGE to 'frag'

	struct DirLight {
		vec3 direction;
		vec3 color;
		float intensity;
	};


	in vec3 v_normal;
	in vec2 v_uv;

	uniform mat4 projMatrix;
	uniform mat4 viewMatrix;
	uniform vec4 viewport;

	uniform DirLight dirLight;

	uniform sampler2D map;
	uniform sampler2D normalMap;

	uniform sampler2D g_pos;
	uniform sampler2D g_diffuse;
	uniform sampler2D g_normal;
	uniform sampler2D g_depth;

	out vec4 fragColor;

	vec3 UnpackNormal(sampler2D normalMap, vec2 uv, vec3 surfPosInEye, vec3 surfNormal) {
		vec3 normalInLocalSpace = texture(normalMap, uv).xyz * 2.0 - 1.0;
		vec3 dPosX = dFdx(surfPosInEye);
		vec3 dPosY = dFdy(surfPosInEye);
		vec2 dUvX = dFdx(uv);
		vec2 dUvY = dFdy(uv);

		vec3 S = normalize( dPosX * dUvY.y - dPosY * dUvX.y );
		vec3 T = normalize( -dPosX * dUvY.x + dPosY* dUvX.x );
		vec3 N = normalize( surfNormal );
    
		mat3 tsn = mat3( S, T, N );
		return normalize( tsn * normalInLocalSpace );
	}

	float ToLinearDepth(float depth) {
		float ndc = depth * 2.0 - 1.0; 
		// https://stackoverflow.com/questions/56428880/how-to-extract-camera-parameters-from-projection-matrix
		float near = projMatrix[3][2]/(projMatrix[2][2] - 1.0);
		float far = projMatrix[2][3]/(projMatrix[2][2] + 1.0);
		float linearDepth = (2.0 * near * far) / (far + near - ndc * (far - near));	
		return linearDepth;
	}

	void main() {
		vec2 uv = (gl_FragCoord.xy - viewport.xy)/viewport.zw;

		float depth = texture(g_depth, uv).r;
		depth = ToLinearDepth(depth);

		vec4 diffuse = texture(g_diffuse, uv);
		vec3 normal = texture(g_normal, uv).xyz;
		vec3 pos = texture(g_pos, uv).xyz;

		

		vec4 normalColor = texture(normalMap, v_uv);
		vec4 posInEye = viewMatrix * vec4(pos, 1.0);
		vec3 mapNormal = UnpackNormal(normalMap, v_uv, posInEye.xyz, normal);

		float dtLN = dot(mapNormal, normalize(dirLight.direction));

		vec4 dirLightColor = vec4(dtLN * dirLight.color * dirLight.intensity, 1.0);
		diffuse += dirLightColor;

		fragColor = diffuse;
	}
`;
