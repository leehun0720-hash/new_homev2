"""TEN AI 사이트의 Lottie 애니메이션을 만든다.

    python3 lottie-src/build_lottie.py      →  public/lottie/*.json

손으로 그리는 대신 코드로 그리는 이유
  선 두께, 오방색, 속도를 한곳에서 맞추고, 바꿀 때 다시 뽑으면 되도록.
  만들어진 JSON 은 표준 Lottie(Bodymovin 5.7) 형식이라 LottieFiles 의
  Lottie Creator 에 그대로 가져가 손볼 수도 있다.

규칙 (tenai.css 와 같은 문법)
  · 선이 그어지는 움직임(trim path)이 기본. 튀는 효과는 쓰지 않는다
  · 오방색은 점과 선에만. 면 칠은 아주 옅게
  · 마지막 프레임이 '완성된 그림'이다. 움직임을 줄인 사용자에게는 그 프레임만 보여 준다
"""
import json, math, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'lottie'
FR = 60

def rgb(h):
    h = h.lstrip('#')
    return [round(int(h[i:i + 2], 16) / 255, 4) for i in (0, 2, 4)] + [1]

INK, JEOK, HWANG, CHEONG, NOK = rgb('#16181a'), rgb('#e0482b'), rgb('#f2b200'), rgb('#3a8aec'), rgb('#2a9a83')
WHITE, NIGHT_FG = rgb('#ffffff'), rgb('#f4f5f3')
OUT_EASE = (0.2, 0.8, 0.2, 1)      # 빠르게 나가 천천히 멈춘다
INOUT = (0.6, 0, 0.2, 1)
LINEAR = (0, 0, 1, 1)
BACK = (0.3, 1.5, 0.6, 1)          # 살짝 넘쳤다 돌아온다 (점이 생길 때만)

# ---------------------------------------------------------------- 값
def S(v):
    return {'a': 0, 'k': v}

def A(keys, ease=OUT_EASE):
    """keys: [(프레임, 값), ...]  값은 숫자 또는 목록"""
    kf = []
    for i, (t, v) in enumerate(keys):
        vv = v if isinstance(v, list) else [v]
        k = {'t': t, 's': vv}
        if i < len(keys) - 1:
            n = len(vv)
            k['o'] = {'x': [ease[0]] * n, 'y': [ease[1]] * n}
            k['i'] = {'x': [ease[2]] * n, 'y': [ease[3]] * n}
        kf.append(k)
    return {'a': 1, 'k': kf}

# ---------------------------------------------------------------- 도형
def path(pts, closed=False):
    n = len(pts)
    return {'ty': 'sh', 'ks': S({'i': [[0, 0]] * n, 'o': [[0, 0]] * n, 'v': pts, 'c': closed})}

def bez(v, i, o, closed=False):
    return {'ty': 'sh', 'ks': S({'i': i, 'o': o, 'v': v, 'c': closed})}

def ell(d, cx=0, cy=0):
    return {'ty': 'el', 'p': S([cx, cy]), 's': S([d, d]), 'd': 1}

def rect(w, h, cx=0, cy=0, r=0):
    return {'ty': 'rc', 'p': S([cx, cy]), 's': S([w, h]), 'r': S(r), 'd': 1}

def stroke(c, w, o=100, dash=None):
    s = {'ty': 'st', 'c': S(c) if not isinstance(c, dict) else c, 'o': S(o) if not isinstance(o, dict) else o,
         'w': S(w), 'lc': 2, 'lj': 2, 'ml': 4}
    if dash:
        s['d'] = [{'n': 'd', 'nm': 'dash', 'v': S(dash[0])}, {'n': 'g', 'nm': 'gap', 'v': S(dash[1])}]
    return s

def fill(c, o=100):
    return {'ty': 'fl', 'c': S(c) if not isinstance(c, dict) else c, 'o': S(o) if not isinstance(o, dict) else o, 'r': 1}

def trim(e, s=None, o=0):
    return {'ty': 'tm', 's': s if s is not None else S(0), 'e': e, 'o': S(o), 'm': 1}

def tr(p=(0, 0), a=(0, 0), s=None, r=None, o=None):
    return {'ty': 'tr', 'p': p if isinstance(p, dict) else S(list(p)), 'a': S(list(a)),
            's': s if s is not None else S([100, 100]), 'r': r if r is not None else S(0),
            'o': o if o is not None else S(100), 'sk': S(0), 'sa': S(0)}

def group(items, t=None, nm='g'):
    return {'ty': 'gr', 'nm': nm, 'it': items + [t or tr()]}

def layer(nm, shapes, p=(0, 0), s=None, r=None, o=None, a=(0, 0), ip=0, op=None):
    ks = {'o': o if o is not None else S(100), 'r': r if r is not None else S(0),
          'p': p if isinstance(p, dict) else S([p[0], p[1], 0]), 'a': S([a[0], a[1], 0]),
          's': s if s is not None else S([100, 100, 100])}
    return {'ddd': 0, 'ty': 4, 'nm': nm, 'sr': 1, 'ks': ks, 'ao': 0, 'shapes': shapes,
            'ip': ip, 'op': op, 'st': 0, 'bm': 0}

def comp(name, w, h, op, layers):
    for i, l in enumerate(layers):
        l['ind'] = i + 1
        if l['op'] is None:
            l['op'] = op
    # Lottie 는 위 층이 먼저 — 목록의 앞쪽이 위에 그려진다
    return {'v': '5.7.4', 'fr': FR, 'ip': 0, 'op': op, 'w': w, 'h': h, 'nm': name, 'ddd': 0, 'assets': [], 'layers': layers}

def draw(t0, t1, ease=INOUT):
    """trim end 0 → 100"""
    return trim(A([(t0, 0), (t1, 100)], ease))

def pop(t0, t1=None, ease=BACK):
    t1 = t1 if t1 is not None else t0 + 14
    return A([(t0, [0, 0]), (t1, [100, 100])], ease)

def pop3(t0, t1=None):
    t1 = t1 if t1 is not None else t0 + 14
    return A([(t0, [0, 0, 100]), (t1, [100, 100, 100])], BACK)

def fade(t0, t1, a=0, b=100, ease=OUT_EASE):
    return A([(t0, a), (t1, b)], ease)

# ================================================================= 오방 아이콘 (96 × 96)
def ob_center():
    L = [layer('nodes', [group([ell(6, x, y), fill(INK)], tr((0, 0)), nm=f'n{i}')
                         for i, (x, y) in enumerate([(0, -30), (30, 0), (0, 30), (-30, 0)])], p=(48, 48),
               s=A([(46, [0, 0, 100]), (60, [100, 100, 100])], BACK)),
         layer('core', [group([ell(16), fill(HWANG)], tr(s=pop(0, 18)))], p=(48, 48)),
         layer('ring1', [group([ell(36), draw(8, 40), stroke(HWANG, 2.5)])], p=(48, 48)),
         layer('ring2', [group([ell(60), draw(16, 52), stroke(INK, 2)])], p=(48, 48)),
         layer('ring3', [group([ell(84), draw(26, 66), stroke(INK, 1.5, 40, dash=(3, 5))])], p=(48, 48))]
    return comp('ob-center', 96, 96, 90, L)

def ob_east():
    L = []
    for i, (x, h, o) in enumerate([(22, 16, 35), (38, 28, 58), (54, 40, 80), (70, 52, 100)]):
        L.append(layer(f'bar{i}', [group([rect(12, h, 0, -h / 2, 1.5), fill(CHEONG, o)],
                                          tr(s=A([(10 + 7 * i, [100, 0]), (30 + 7 * i, [100, 100])], BACK)))],
                       p=(x, 74)))
    L.append(layer('base', [group([path([[14, 78], [82, 78]]), draw(0, 18), stroke(INK, 2)])]))
    return comp('ob-east', 96, 96, 90, L)

def ob_south():
    pts = [[14, 70], [40, 70], [60, 50], [78, 50]]
    L = [layer('pulse', [group([ell(12), stroke(JEOK, 2)], tr(s=A([(54, [100, 100]), (88, [260, 260])], OUT_EASE),
                                                             o=A([(53, 0), (54, 80), (88, 0)], OUT_EASE)))], p=(78, 50)),
         layer('end', [group([ell(12), fill(JEOK)], tr(s=pop(44, 58)))], p=(78, 50)),
         layer('mid2', [group([ell(5), fill(INK)], tr(s=pop(34)))], p=(60, 50)),
         layer('mid1', [group([ell(5), fill(INK)], tr(s=pop(22)))], p=(40, 70)),
         layer('start', [group([ell(9), fill(WHITE), stroke(INK, 2)], tr(s=pop(0, 12)))], p=(14, 70)),
         layer('line', [group([path(pts), draw(6, 46), stroke(INK, 2.5)])])]
    return comp('ob-south', 96, 96, 90, L)

def ob_west():
    def block(nm, x, y, dy, t0, t1):
        return layer(nm, [group([rect(22, 22, 0, 0, 2), fill(WHITE), stroke(INK, 2.5)])],
                     p=A([(t0, [x, y + dy, 0]), (t1, [x, y, 0])], OUT_EASE), o=fade(t0, t0 + 8))
    L = [layer('core', [group([rect(8, 8, 0, 0, 1), fill(INK)], tr(s=pop(46, 60)))], p=(49, 40)),
         block('top', 49, 40, -18, 22, 44),
         block('right', 61, 64, 14, 8, 28),
         block('left', 37, 64, 14, 0, 20),
         layer('base', [group([path([[16, 79], [80, 79]]), draw(0, 16), stroke(INK, 2, 50)])])]
    return comp('ob-west', 96, 96, 90, L)

def ob_north():
    L = []
    for i, y in enumerate([27, 48, 69]):
        t = 44 + 8 * i
        L.append(layer(f'led{i}', [group([ell(5, 32, y), fill(NOK)])],
                       o=A([(t, 0), (t + 4, 100), (76, 100), (80, 25), (86, 100)], LINEAR)))
        L.append(layer(f'vent{i}', [group([path([[52, y], [64, y]]), draw(30 + 4 * i, 44 + 4 * i), stroke(INK, 1.5, 50)])]))
    for i, y in enumerate([37.5, 58.5]):
        L.append(layer(f'div{i}', [group([path([[25, y], [71, y]]), draw(18 + 6 * i, 38 + 6 * i), stroke(INK, 2)])]))
    L.append(layer('rack', [group([rect(48, 64, 48, 48, 3), draw(0, 30), stroke(INK, 2.5)])]))
    return comp('ob-north', 96, 96, 90, L)

# ================================================================= 사업영역 나머지 (96 × 96)
def biz_platform():
    L = [layer('hub', [group([ell(9), fill(HWANG)], tr(s=pop(52, 64)))], p=(48, 48)),
         layer('links', [group([path([[34, 34], [62, 62]]), path([[62, 34], [34, 62]]), draw(30, 54), stroke(CHEONG, 2)])])]
    for i, (x, y) in enumerate([(34, 34), (62, 34), (34, 62), (62, 62)]):
        L.append(layer(f'tile{i}', [group([rect(22, 22, 0, 0, 3), fill(WHITE), stroke(INK, 2)], tr(s=pop(6 * i, 6 * i + 16)))], p=(x, y)))
    return comp('biz-platform', 96, 96, 90, L)

def biz_trainer():
    ends = [((22, 72), JEOK), ((48, 78), HWANG), ((74, 72), CHEONG)]
    L = []
    for i, ((x, y), c) in enumerate(ends):
        L.append(layer(f'dot{i}', [group([ell(11), fill(c)], tr(s=pop(30 + 6 * i)))], p=(x, y)))
        L.append(layer(f'line{i}', [group([path([[48, 38], [x, y]]), draw(14 + 6 * i, 36 + 6 * i), stroke(INK, 2)])]))
    L.insert(0, layer('src', [group([ell(14), fill(INK)], tr(s=pop(0, 14)))], p=(48, 36)))
    return comp('biz-trainer', 96, 96, 90, L)

def biz_research():
    L = [layer('mark', [group([rect(30, 7, 15, 0, 1), fill(HWANG, 55)], tr(s=A([(48, [0, 100]), (64, [100, 100])], OUT_EASE)))],
               p=(33, 40))]
    for i, (y, x2) in enumerate([(30, 62), (40, 62), (50, 62), (60, 52)]):
        L.append(layer(f'txt{i}', [group([path([[34, y], [x2, y]]), draw(18 + 6 * i, 32 + 6 * i), stroke(INK, 2, 60)])]))
    L.append(layer('page', [group([rect(46, 60, 48, 46, 3), draw(0, 26), stroke(INK, 2.5)])]))
    return comp('biz-research', 96, 96, 90, L)

def biz_partner():
    L = [layer('ring', [group([ell(10), stroke(HWANG, 2)], tr(s=A([(38, [100, 100]), (72, [300, 300])], OUT_EASE),
                                                             o=A([(37, 0), (38, 90), (72, 0)], OUT_EASE)))], p=(48, 48)),
         layer('spark', [group([ell(9), fill(HWANG)], tr(s=pop(28, 40)))], p=(48, 48)),
         layer('b', [group([ell(40), stroke(JEOK, 2.5)])], p=A([(0, [74, 48, 0]), (28, [58, 48, 0])], OUT_EASE), o=fade(0, 10)),
         layer('a', [group([ell(40), stroke(INK, 2.5)])], p=A([(0, [22, 48, 0]), (28, [38, 48, 0])], OUT_EASE), o=fade(0, 10))]
    return comp('biz-partner', 96, 96, 90, L)

# ================================================================= 두 갈래 입구 (96 × 96)
def door_org():
    L = [layer('lit', [group([rect(5, 5, 0, 0, 0.5), fill(JEOK)], tr(s=pop(58, 70)))], p=(64, 58))]
    for i, (x, y) in enumerate([(30, 34), (42, 34), (30, 46), (42, 46), (30, 58), (42, 58), (58, 58), (70, 58), (70, 70)]):
        L.append(layer(f'w{i}', [group([rect(5, 5, 0, 0, 0.5), fill(INK, 70)], tr(s=pop(32 + 3 * i, 44 + 3 * i)))], p=(x, y)))
    L += [layer('short', [group([rect(26, 36, 64, 62, 1.5), draw(12, 34), stroke(INK, 2.5)])]),
          layer('tall', [group([rect(26, 60, 36, 50, 1.5), draw(4, 30), stroke(INK, 2.5)])]),
          layer('ground', [group([path([[12, 80], [84, 80]]), draw(0, 16), stroke(INK, 2)])])]
    return comp('door-org', 96, 96, 100, L)

def door_learn():
    left = bez([[48, 34], [14, 30], [14, 70], [48, 76]], [[0, 0], [10, 0], [0, 0], [-12, -4]], [[-12, -4], [0, 0], [10, 0], [0, 0]], True)
    right = bez([[48, 34], [82, 30], [82, 70], [48, 76]], [[0, 0], [-10, 0], [0, 0], [12, -4]], [[12, -4], [0, 0], [-10, 0], [0, 0]], True)
    L = [layer('ribbon', [group([path([[70, 30], [70, 50], [65, 45], [60, 50], [60, 30]], True), fill(CHEONG)])],
               p=A([(46, [0, -18, 0]), (62, [0, 0, 0])], OUT_EASE), o=fade(46, 52))]
    for i, (x1, y1, x2, y2) in enumerate([(22, 44, 40, 46), (22, 54, 40, 56), (56, 46, 74, 44), (56, 56, 74, 54)]):
        L.append(layer(f'l{i}', [group([path([[x1, y1], [x2, y2]]), draw(26 + 5 * i, 40 + 5 * i), stroke(INK, 2, 55)])]))
    L += [layer('spine', [group([path([[48, 34], [48, 76]]), draw(18, 30), stroke(INK, 2)])]),
          layer('pages', [group([left, right, draw(0, 30), fill(WHITE), stroke(INK, 2.5)])])]
    return comp('door-learn', 96, 96, 100, L)

# ================================================================= RUNIQ STUDIO: 도면이 공간이 된다 (200 × 150)
def runiq_room():
    F, R, B, Lf = [100, 128], [164, 96], [100, 64], [36, 96]     # 바닥 꼭짓점: 앞 · 오른쪽 · 뒤 · 왼쪽
    H = 52
    up = lambda p: [p[0], p[1] - H]
    wall_l = [Lf, up(Lf), up(B), B]
    wall_r = [B, up(B), up(R), R]
    floor = [F, R, B, Lf]
    # 가구(낮은 장): 바닥 위 작은 상자
    c = [100, 104]
    bw, bd, bh = 26, 14, 14
    bx = lambda dx, dy, dz=0: [c[0] + dx * 0.866 * 1 - dy * 0.866, c[1] + dx * 0.5 + dy * 0.5 - dz]
    top = [bx(-bw / 2, -bd / 2, bh), bx(bw / 2, -bd / 2, bh), bx(bw / 2, bd / 2, bh), bx(-bw / 2, bd / 2, bh)]
    front = [bx(-bw / 2, bd / 2, 0), bx(bw / 2, bd / 2, 0), bx(bw / 2, bd / 2, bh), bx(-bw / 2, bd / 2, bh)]
    side = [bx(bw / 2, -bd / 2, 0), bx(bw / 2, bd / 2, 0), bx(bw / 2, bd / 2, bh), bx(bw / 2, -bd / 2, bh)]
    win = [[124, 62], [146, 51], [146, 69], [124, 80]]
    line_o = A([(0, 100), (86, 100), (118, 55)], LINEAR)
    L = [
        layer('window', [group([path(win, True), fill(HWANG, A([(96, 0), (124, 70)], OUT_EASE))])]),
        layer('box', [group([path(top, True), path(front, True), path(side, True), draw(52, 80),
                             fill(NIGHT_FG, A([(86, 0), (118, 14)], OUT_EASE)), stroke(CHEONG, 1.5, line_o)])]),
        layer('walls', [group([path(wall_l, True), path(wall_r, True), draw(14, 50),
                               fill(NIGHT_FG, A([(86, 0), (118, 8)], OUT_EASE)), stroke(CHEONG, 1.5, line_o)])]),
        layer('floor', [group([path(floor, True), draw(0, 26),
                               fill(HWANG, A([(86, 0), (118, 12)], OUT_EASE)), stroke(CHEONG, 1.5, line_o)])]),
        layer('grid', [group([path([[68, 112], [132, 80]]), path([[68, 80], [132, 112]]), draw(20, 46),
                              stroke(CHEONG, 1, A([(0, 45), (86, 45), (118, 0)], LINEAR), dash=(2, 4))])]),
    ]
    return comp('runiq-room', 200, 150, 130, L)

# ================================================================= 쪽 머리: 오방 겹 원 (720 × 720)
def rings():
    C = 360
    cols = [(JEOK, 55), (HWANG, 50), (CHEONG, 50), (NOK, 45), (NIGHT_FG, 18)]
    L = [layer('orbit', [group([ell(7, 0, -260), fill(HWANG)])], p=(C, C),
               r=A([(72, 0), (972, 360)], LINEAR), o=fade(60, 72))]
    for i, (c, o) in enumerate(cols):
        d = 520 + 46 * i
        L.append(layer(f'ring{i}', [group([ell(d), trim(A([(6 * i, 0), (60 + 6 * i, 100)], INOUT), o=-90 + 12 * i), stroke(c, 1.5, o)])],
                       p=(C, C)))
    return comp('rings', 720, 720, 972, L)

# ================================================================= 상담: 오방 다섯 가닥 (112 × 44)
def threads():
    cols = [JEOK, HWANG, CHEONG, NOK, INK]
    L = []
    for i, c in enumerate(cols):
        y = 6 + 8 * i
        t = 44 + 14 * i                      # 신호가 출발하는 프레임
        sig_s = A([(t, 0), (t + 60, 100)], LINEAR)
        sig_e = A([(t, 0), (t + 8, 16), (t + 52, 100)], LINEAR)
        L.append(layer(f'sig{i}', [group([path([[2, y], [110, y]]), trim(sig_e, sig_s), stroke(c, 6 if i < 4 else 5, 100)])]))
        L.append(layer(f'line{i}', [group([path([[2, y], [110, y]]), draw(4 * i, 30 + 4 * i), stroke(c, 4 if i < 4 else 3.5, 100 if i < 4 else 85)])]))
    return comp('threads', 112, 44, 44 + 14 * 4 + 64, L)

# ================================================================= 첫 화면: 연화 머리초 (720 × 720)
# index.html 의 SVG 연꽃과 같은 좌표(꽃 중심 0,0 · 큰 꽃잎 끝 262)를 쓰고, 화면에서는
# 도면(1440 × 900)의 (720, 520) 에 0.72 배로 놓인다 (tenai.css .hero-rosette).
#   0 ~ 170f   꽃잎이 안쪽부터 차례로 그려진다 (원래 CSS 그리기와 같은 순서·속도)
#   170f ~     20초 되풀이: 꽃이 45° 돈다(여덟 겹 대칭이라 이음매가 없다)
#              · 회로 신호가 큰 꽃잎을 차례로 한 바퀴씩 돈다 (5초에 한 바퀴, 네 번)
#              · 5초마다 가운데 TenOS 코어에서 파동이 퍼진다
ROS_C = 360
ROS_LOOP0, ROS_LOOP_LEN = 170, 1200

def _petal_pts(big=True):
    """SVG 의 #petal / #petal-s 를 Lottie 꼭짓점·접선으로 (시작점: 꽃잎 밑동)"""
    if big:
        return [[0, -78], [0, -262]], [[-58, -40], [60, 50]], [[58, -40], [-60, 50]]
    return [[0, -40], [0, -128]], [[-23, -20], [25, 22]], [[23, -20], [-25, 22]]

def _xf(v, i, o, k=1.0, pivot=(0, 0), deg=0.0):
    """pivot 기준 k 배 → 원점 기준 deg 회전. 접선은 크기·회전만 받는다"""
    c, s_ = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    rot = lambda x, y: [round(x * c - y * s_, 3), round(x * s_ + y * c, 3)]
    vv = [rot(pivot[0] + (x - pivot[0]) * k, pivot[1] + (y - pivot[1]) * k) for x, y in v]
    ii = [rot(x * k, y * k) for x, y in i]
    oo = [rot(x * k, y * k) for x, y in o]
    return vv, ii, oo

def _petal(big, k, pivot, deg):
    v, i, o = _xf(*_petal_pts(big), k=k, pivot=pivot, deg=deg)
    return bez([[x + ROS_C, y + ROS_C] for x, y in v], i, o, True)

def rosette():
    L0, LN = ROS_LOOP0, ROS_LOOP_LEN
    END = L0 + LN
    t_draw = lambda i: (12 + 5.4 * i, 12 + 5.4 * i + 96)          # CSS: i×90ms + 200ms, 1.6s
    spin = A([(0, 0), (L0, 0), (END, 45)], LINEAR)
    big_layers = [(1.0, NIGHT_FG, 80, 0), (0.78, JEOK, 100, 1), (0.56, HWANG, 100, 2), (0.34, CHEONG, 100, 3)]
    small_layers = [(1.0, NIGHT_FG, 38, 2), (0.6, NOK, 100, 3)]

    petals = []
    for m in range(8):
        for k, col, op, di in big_layers:
            a, b = t_draw(m + di)
            petals.append(group([_petal(True, k, (0, -170), 45 * m), draw(a, b), stroke(col, 1.15, op)], nm=f'p{m}-{di}'))
        for k, col, op, di in small_layers:
            a, b = t_draw(m + di)
            petals.append(group([_petal(False, k, (0, -84), 45 * m + 22.5), draw(a, b), stroke(col, 1.15, op)], nm=f's{m}-{di}'))

    # 회로 신호: 큰 꽃잎 바깥 선을 따라 밑동 → 끝 → 밑동. 30f 간격으로 다음 꽃잎.
    # 여덟 장을 돌고(270f) 30f 쉰 뒤 다시 — 쉬는 틈이 되풀이의 이음매에 걸리게 해서
    # 이음매에서도, 멈춘 장면(움직임 줄이기)에서도 신호가 걸쳐 있지 않다.
    signals = []
    for m in range(8):
        wins = [L0 + 300 * n + 30 * m for n in range(4)]
        ok, off = [(0, 0)], [(0, 0)]
        for st in wins:
            ok += [(st, 0), (st + 6, 100), (st + 46, 100), (st + 60, 0)]
            off += [(st, 0), (st + 60, 360)]
        ok = sorted(set(ok)); off = sorted(set(off))
        glow = [(t, v * 0.22) for t, v in ok]
        sig_trim = {'ty': 'tm', 's': S(0), 'e': S(15), 'o': A(off, LINEAR), 'm': 1}
        signals.append(group([_petal(True, 1.0, (0, -170), 45 * m), sig_trim,
                              stroke(HWANG, 2.8, A(ok, LINEAR)),            # 신호
                              stroke(HWANG, 9, A(glow, LINEAR))], nm=f'sig{m}'))   # 번짐

    # 코어 파동 (5초마다)
    rip_d, rip_o = [(0, [84, 84])], [(0, 0)]
    for n in range(0, 5):
        st = L0 + 300 * n
        rip_d += [(st, [84, 84]), (st + 150, [600, 600])]
        rip_o += [(st, 0), (st + 1, 55), (st + 150, 0)]
    ripple = group([{'ty': 'el', 'p': S([ROS_C, ROS_C]), 's': A(rip_d, OUT_EASE), 'd': 1},
                    stroke(HWANG, 1.5, A(rip_o, OUT_EASE))], nm='ripple')

    stamens = []
    for j in range(12):
        ang = math.radians(30 * j - 90)
        x, y = ROS_C + 58 * math.cos(ang), ROS_C + 58 * math.sin(ang)
        stamens.append(layer(f'stamen{j}', [group([ell(4.8), fill(HWANG)], tr(s=pop(96 + 4 * j, 110 + 4 * j)))], p=(x, y)))

    a, b = t_draw(10)
    L = [layer('core', [group([ell(26), fill(HWANG)], tr(s=pop(70, 88)))], p=(ROS_C, ROS_C))] + stamens + [
        layer('core-ring', [group([ell(84, ROS_C, ROS_C), draw(a, b), stroke(HWANG, 1.2)])]),
        layer('signals', signals, p=(ROS_C, ROS_C), a=(ROS_C, ROS_C), r=spin),
        layer('flower', petals, p=(ROS_C, ROS_C), a=(ROS_C, ROS_C), r=spin),
        layer('ripple', [ripple]),
    ]
    return comp('rosette', 720, 720, END, L)

ALL = {
    'ob-center': ob_center, 'ob-east': ob_east, 'ob-south': ob_south, 'ob-west': ob_west, 'ob-north': ob_north,
    'biz-platform': biz_platform, 'biz-trainer': biz_trainer, 'biz-research': biz_research, 'biz-partner': biz_partner,
    'door-org': door_org, 'door-learn': door_learn, 'runiq-room': runiq_room, 'rings': rings, 'threads': threads,
    'rosette': rosette,
}

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in ALL.items():
        data = fn()
        (OUT / f'{name}.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
        print(f'{name:14s} {data["w"]}x{data["h"]} {data["op"]:4d}f  {len(json.dumps(data, separators=(",", ":"))) / 1024:.1f}KB')
