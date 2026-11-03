uniform sampler2D u_TextureMap;

uniform vec4      u_Color;

uniform vec2      u_InvTexRes;
varying vec2      var_TexCoords;

void main()
{
	vec4 color;
	vec2 tc;

#if 0
	float c[7];

	c[0] = 1.0;
	c[1] = 0.9659258263;
	c[2] = 0.8660254038;
	c[3] = 0.7071067812;
	c[4] = 0.5;
	c[5] = 0.2588190451;
	c[6] = 0.0;

	tc = var_TexCoords + u_InvTexRes * vec2(  c[0],  c[6]);  color =  texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[1],  c[5]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[2],  c[4]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[3],  c[3]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[4],  c[2]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[5],  c[1]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[6],  c[0]);  color += texture2D(u_TextureMap, tc);

	tc = var_TexCoords + u_InvTexRes * vec2(  c[1], -c[5]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[2], -c[4]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[3], -c[3]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[4], -c[2]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[5], -c[1]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c[6], -c[0]);  color += texture2D(u_TextureMap, tc);

	tc = var_TexCoords + u_InvTexRes * vec2( -c[0],  c[6]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c[1],  c[5]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c[2],  c[4]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c[3],  c[3]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c[4],  c[2]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c[5],  c[1]);  color += texture2D(u_TextureMap, tc);

	tc = var_TexCoords + u_InvTexRes * vec2( -c[1], -c[5]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c[2], -c[4]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c[3], -c[3]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c[4], -c[2]);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c[5], -c[1]);  color += texture2D(u_TextureMap, tc);
	
	gl_FragColor = color * 0.04166667 * u_Color;
#endif

	// WoP web: constant-indexed local float arrays crash SwiftShader (headless Chrome); use scalars

	const float c0 = 1.0;
	const float c1 = 0.9238795325;
	const float c2 = 0.7071067812;
	const float c3 = 0.3826834324;
	const float c4 = 0.0;

	tc = var_TexCoords + u_InvTexRes * vec2(  c0,  c4);  color =  texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c1,  c3);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c2,  c2);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c3,  c1);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c4,  c0);  color += texture2D(u_TextureMap, tc);

	tc = var_TexCoords + u_InvTexRes * vec2(  c1, -c3);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c2, -c2);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c3, -c1);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2(  c4, -c0);  color += texture2D(u_TextureMap, tc);

	tc = var_TexCoords + u_InvTexRes * vec2( -c0,  c4);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c1,  c3);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c2,  c2);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c3,  c1);  color += texture2D(u_TextureMap, tc);

	tc = var_TexCoords + u_InvTexRes * vec2( -c1, -c3);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c2, -c2);  color += texture2D(u_TextureMap, tc);
	tc = var_TexCoords + u_InvTexRes * vec2( -c3, -c1);  color += texture2D(u_TextureMap, tc);
	
	gl_FragColor = color * 0.0625 * u_Color;
}
