/**
 * GLSL живых фонов экрана проектора.
 *
 * Каждый фон — одна функция `scene(uv, p, t)`, общая обвязка (шум, палитра,
 * виньетка, зерно) приклеивается в renderer.ts. WebGL 1 / GLSL ES 1.0:
 * циклы только с константными границами, без динамической индексации.
 *
 * Координаты: `uv` — 0..1 по экрану, `p` — от центра с поправкой на аспект
 * (по вертикали −0.5..0.5). Палитра приходит униформами uBg, uC1..uC3.
 * Яркость подобрана так, чтобы белый текст поверх держал контраст ≥ 7:1.
 */

export const SHADER_HEAD = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uGrain; uniform float uVig;
uniform vec3 uBg; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p; a*=.5; } return v; }
float grainHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 pick(float i){ return i<.5 ? uC1 : (i<1.5 ? uC2 : uC3); }
`

/** Виньетка и зерно: зерно рвёт полосы градиента на 8-битных проекторах */
export const SHADER_FOOT = `
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - .5*uRes) / uRes.y;
  vec3 col = scene(uv, p, uTime);
  vec2 q = uv - .5;
  col *= 1. - uVig * smoothstep(.15, .85, length(q*vec2(1.1, 1.3)));
  col += (grainHash(gl_FragCoord.xy + fract(uTime*7.)*61.) - .5) * uGrain * (1./64.);
  gl_FragColor = vec4(max(col, 0.), 1.);
}`

export const SCENES: Record<string, string> = {
  mesh: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec2 q = p + .07*vec2(sin(p.y*3.1 + t*.35), cos(p.x*2.7 - t*.28));
  vec2 a = vec2(sin(t*.19)*.55, cos(t*.15)*.28);
  vec2 b = vec2(cos(t*.13+2.)*.65, sin(t*.17+1.)*.32);
  vec2 c = vec2(sin(t*.11+4.)*.6, cos(t*.21+3.)*.3);
  float wa = exp(-dot(q-a,q-a)*3.2), wb = exp(-dot(q-b,q-b)*3.6), wc = exp(-dot(q-c,q-c)*4.);
  float w0 = .45;
  return (uBg*w0 + uC1*wa + uC2*wb + uC3*wc) / (w0 + wa + wb + wc) * .85;
}`,

  fog: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec2 q = p*1.5;
  vec2 w = vec2(fbm(q + vec2(0., t*.04)), fbm(q + vec2(5.2, 1.3) - t*.035));
  float f = fbm(q + 2.2*w + vec2(t*.025, 0.));
  vec3 col = mix(uBg, uC1*.8, smoothstep(.3, .85, f));
  col = mix(col, uC2*.7, smoothstep(.55, .95, w.x)*.5);
  col += uC3 * pow(f, 4.) * .35;
  return col;
}`,

  silk: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec3 col = uBg;
  for(int i=0;i<4;i++){
    float fi = float(i);
    float y = -.28 + fi*.11 + .12*sin(p.x*(1.1 + fi*.3) + t*(.22 + fi*.05) + fi*1.3) + .05*sin(p.x*3.1 - t*.18 + fi);
    float d = p.y - y;
    float line = exp(-abs(d)*(70. - fi*10.)) * .45;
    float fill = (1. - step(0., d)) * exp(d*3.5) * .11;
    vec3 c = fi < 2.5 ? pick(fi) : mix(uC1, uC3, .5);
    col += c * (line + fill);
  }
  return col;
}`,

  stars: `
vec3 scene(vec2 uv, vec2 p, float t){
  float n = fbm(p*1.4 + vec2(t*.008, 0.));
  vec3 col = uBg + uC1*.35*smoothstep(.35, .9, n) + uC3*.25*pow(fbm(p*2.3 + 3. - t*.006), 3.);
  for(int l=0;l<3;l++){
    float fl = float(l);
    vec2 g = (p + vec2(t*.003*(fl+1.), 0.)) * (36. + fl*30.);
    vec2 id = floor(g), f = fract(g) - .5;
    float h = hash(id + fl*17.);
    vec2 o = vec2(hash(id + 3.1), hash(id + 5.7)) - .5;
    float dd = length(f - o*.6);
    float tw = .55 + .45*sin(t*(.8 + h*2.5) + h*40.);
    col += vec3(.9, .94, 1.) * .0025/(dd*dd + .0025) * step(.86, h) * (h - .86) * 7. * tw * (.5 + .25*fl);
  }
  return col;
}`,

  aurora: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec3 col = uBg + uC2*.06*(1.-uv.y);
  for(int i=0;i<3;i++){
    float fi = float(i);
    float x = p.x*1.1 + fi*1.7;
    float y = .12 - fi*.1 + .22*(fbm(vec2(x*.7 + t*.04*(1.+fi*.3), fi*3.1 + t*.025)) - .5);
    float d = p.y - y;
    float body = exp(-max(d, 0.)*(5.+fi)) * smoothstep(-.03, .02, d);
    float streak = .55 + .45*noise(vec2(x*16., t*.15 + fi));
    col += pick(fi) * body * streak * .5;
  }
  return col;
}`,

  glass: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec2 g = p*4.6;
  vec2 id = floor(g), f = fract(g);
  float md = 8., md2 = 8.; vec2 mid = vec2(0.);
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 b = vec2(float(i), float(j));
    vec2 o = vec2(hash(id+b), hash(id+b+13.7));
    o = .5 + .33*sin(t*.12 + 6.2831*o);
    vec2 r = b + o - f;
    float d = dot(r, r);
    if(d < md){ md2 = md; md = d; mid = id + b; } else if(d < md2){ md2 = d; }
  }
  float edge = sqrt(md2) - sqrt(md);
  float h = hash(mid*1.7 + 3.3);
  vec3 c = pick(floor(h*3.));
  float glow = .35 + .65*pow(.5 + .5*sin(t*.35 + h*20.), 2.);
  float light = .45 + .55*(1. - smoothstep(-.6, .9, p.y*.9 - p.x*.35));
  vec3 glassCol = c * glow * light * (.6 + .4*noise(g*3. + h*9.)) * .85;
  float lead = smoothstep(.03, .09, edge);
  return mix(uBg*.4, glassCol, lead);
}`,

  candles: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec3 col = uBg + uC1*.10*(1. - uv.y);
  float asp = uRes.x/uRes.y;
  for(int i=0;i<9;i++){
    float fi = float(i);
    float h = hash(vec2(fi, 4.2));
    float z = .55 + .6*hash(vec2(fi, 2.7));
    vec2 base = vec2((fi/8. - .5)*asp*.88 + (h - .5)*.08, -.34 + (hash(vec2(fi, 9.1)) - .5)*.14);
    float fl = .8 + .2*noise(vec2(t*3. + fi*7., fi));
    vec2 d = p - base;
    col += mix(uC1, uC2, .6) * exp(-dot(d, d)*(16./z)) * .32 * fl;
    float body = (1. - smoothstep(.010*z, .013*z, abs(d.x))) * (1. - step(-.012*z, d.y)) * exp(d.y*6.);
    col += uC3*.9*body + uC2*.12*body;
    vec2 fd = d - vec2(.004*z*sin(t*4. + fi*3.)*(d.y*30.), .022*z);
    float up = max(fd.y, 0.), dn = min(fd.y, 0.);
    float flame = exp(-(fd.x*fd.x*9000./z + up*up*1400./z + dn*dn*6000./z));
    col += vec3(1., .78, .45) * flame * fl * 1.2;
  }
  return col;
}`,

  rays: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec2 src = vec2(.18*sin(t*.04), .78);
  vec2 d = p - src;
  float ang = atan(d.x, -d.y);
  float r = length(d);
  float rays = .5*noise(vec2(ang*7. + t*.04, t*.08)) + .5*noise(vec2(ang*17. - t*.05, 3. + t*.1));
  rays = pow(rays, 2.4) * 1.7;
  float fall = exp(-r*1.15);
  vec3 col = uBg + mix(uC2, uC1, uv.y*.8) * rays * fall * .75 + uC3 * exp(-r*r*2.5) * .22;
  vec2 g = (p + vec2(t*.01, t*.025)) * 22.;
  vec2 id = floor(g), f = fract(g) - .5;
  float h = hash(id);
  vec2 o = vec2(hash(id + 2.3), hash(id + 7.7)) - .5;
  float dd = length(f - o*.7);
  float dust = step(.7, h) * .004/(dd*dd + .004) * (.5 + .5*sin(t*.9 + h*30.));
  col += vec3(1., .95, .85) * dust * rays * fall * .5;
  return col;
}`,

  caustics: `
vec3 scene(vec2 uv, vec2 p, float t){
  float time = t*.3 + 23.;
  vec2 q = p*3.2 - 250.;
  vec2 i = q;
  float c = 1.;
  for(int n=0;n<4;n++){
    float tt = time * (1. - 3.5/float(n+1));
    i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1./length(vec2(q.x/(sin(i.x + tt)/.005), q.y/(cos(i.y + tt)/.005)));
  }
  c /= 4.;
  c = 1.17 - pow(c, 1.4);
  float v = clamp(pow(abs(c), 6.), 0., 1.);
  vec3 water = mix(uBg, uC2*.45, smoothstep(-.6, .6, p.y)*.8 + .1);
  return water + mix(uC1, uC3, uv.x)*1.2 * v * .9 + vec3(.6, .8, .9) * pow(v, 3.) * .15;
}`,

  bokeh: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec3 col = mix(uBg, uC1*.22, 1. - smoothstep(0., 1., uv.y));
  float asp = uRes.x/uRes.y;
  for(int i=0;i<30;i++){
    float fi = float(i);
    float h1 = hash(vec2(fi, 1.3)), h2 = hash(vec2(fi, 7.1)), h3 = hash(vec2(fi, 3.7));
    vec2 c = vec2((h1-.5)*asp*1.15 + .05*sin(t*.25 + fi), mod(h2 + t*(.015 + .03*h3), 1.5) - .75);
    float r = .03 + .11*h3*h3;
    float d = length(p - c);
    float disk = 1. - smoothstep(r*.82, r, d);
    float rim = smoothstep(r*.6, r*.95, d) * disk;
    float tw = .55 + .45*sin(t*.6 + fi*2.3);
    col += pick(floor(h1*3.)) * (disk*.8 + rim*.4) * (.10 + .14*tw) * (1.1 - .6*h3);
  }
  return col;
}`,

  sky: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec2 sp = vec2(.3, -.36 + .05*sin(t*.03));
  float sd = length(p - sp);
  vec3 sky = mix(uC2*.85, uBg, smoothstep(-.45, .5, p.y));
  sky = mix(sky, uC3*.5, smoothstep(.05, .5, p.y)*.5);
  sky += uC2*exp(-sd*3.5)*.45 + vec3(1., .86, .62)*exp(-sd*26.)*.55;
  float cl = fbm(vec2(p.x*1.4 + t*.02, p.y*4.2) + vec2(0., t*.004));
  cl = smoothstep(.48, .82, cl) * smoothstep(-.5, .05, p.y);
  vec3 cloudCol = mix(uBg*1.4 + uC3*.25, uC2*.9 + vec3(.08), exp(-sd*2.2));
  return mix(sky, cloudCol, cl*.85);
}`,

  mountains: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec3 col = mix(uC2*.55, uBg, smoothstep(-.3, .5, p.y));
  col += uC2*exp(-length(p - vec2(-.35, -.02))*3.)*.35;
  for(int i=0;i<4;i++){
    float fi = float(i);
    float x = p.x*(1.1 + fi*.45) + t*.006*(fi + 1.)*(fi + 1.) + fi*10.;
    float h = -.02 - fi*.11 + .2*(fbm(vec2(x, fi*3.)) - .5)*(1. + fi*.25);
    float m = 1. - smoothstep(-.002, .002, p.y - h);
    vec3 layer = mix(uC1*.42 + uC2*.12, uBg*.55, fi/3.);
    col = mix(col, layer, m);
    col += uC3*.10*exp(-abs(p.y - h + .04)*14.)*(1. - fi/4.);
  }
  return col;
}`,

  snow: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec3 col = mix(uBg, uC1*.35, 1. - smoothstep(-.6, .6, p.y));
  for(int l=0;l<4;l++){
    float fl = float(l);
    float sc = 5. + fl*4.;
    vec2 q = p*sc;
    q.y += t*(.5 + fl*.25);
    q.x += sin(q.y*.4 + t*.4 + fl*2.)*.35;
    vec2 id = floor(q), f = fract(q) - .5;
    float h = hash(id + fl*11.);
    vec2 o = vec2(hash(id + 1.7), hash(id + 9.3)) - .5;
    float d = length(f - o*.6);
    float r = .05 + .07*h;
    float flake = (1. - smoothstep(r*.3, r, d)) * step(.4, h);
    col += vec3(.92, .95, 1.) * flake * (.85 - fl*.16);
  }
  return col;
}`,

  leaves: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec3 col = mix(uBg, uC1*.25, 1. - smoothstep(-.6, .6, p.y));
  for(int l=0;l<3;l++){
    float fl = float(l);
    float sc = 3.5 + fl*2.5;
    vec2 q = p*sc;
    q.y += t*(.25 + fl*.1);
    q.x += sin(q.y*.6 + t*.5 + fl)*.4 + t*.08;
    vec2 id = floor(q);
    float h = hash(id + fl*7.);
    vec2 o = vec2(hash(id + 1.1), hash(id + 4.4)) - .5;
    vec2 f = fract(q) - .5 - o*.4;
    float a = t*(.6 + h*1.5) + h*6.28;
    vec2 lf = mat2(cos(a), -sin(a), sin(a), cos(a)) * f;
    lf.x *= 1. / (.35 + .65*abs(sin(a*.7)));
    float leaf = 1. - smoothstep(.11, .14, length(vec2(lf.x*1.9, lf.y)));
    vec3 c = pick(floor(hash(id + 2.2)*3.)) * (1.35 - fl*.3);
    col = mix(col, c, leaf * step(.5, h) * (.9 - fl*.2));
  }
  return col;
}`,

  leaks: `
vec3 scene(vec2 uv, vec2 p, float t){
  vec3 col = uBg;
  vec2 a = vec2(-.85 + .25*sin(t*.07), .32 + .15*sin(t*.05));
  vec2 b = vec2(.9 + .2*cos(t*.06), -.28 + .2*sin(t*.08 + 1.));
  vec2 da = (p - a)*vec2(1., 1.6), db = (p - b)*vec2(1.4, 1.);
  float la = exp(-dot(da, da)*2.4) * (.65 + .35*sin(t*.3));
  float lb = exp(-dot(db, db)*3.) * (.65 + .35*sin(t*.23 + 2.));
  col += uC2*la*.95 + uC1*lb*.85 + uC3*la*lb*1.5;
  col += uC2 * exp(-abs(p.x + .4*sin(t*.05))*7.) * .10 * noise(vec2(t*.4, 0.));
  col *= .93 + .07*noise(vec2(t*6., 1.));
  col += step(.9985, hash(vec2(floor(p.x*300.), floor(t*12.)))) * .12;
  return col;
}`,
}
