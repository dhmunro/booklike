"""Support for selenized and solarized color themes.

Based on javascript code found in W3C CSS color standard at
  https://www.w3.org/TR/css-color-4/#predefined-to-lab-oklab

To convert screen RGB to CIELab, the standard algorithm has four steps:
    1. Convert from gamma-encoded RGB to linear-light RGB (undo gamma encoding)
    2. Convert from linear RGB to CIE XYZ
    3. If needed, convert from a D65 whitepoint (used by sRGB, display-p3,
       a98-rgb and rec2020) to the D50 whitepoint used in Lab, with the linear
       Bradford transform. prophoto-rgb already has a D50 whitepoint.
    4. Convert D50-adapted XYZ to Lab 

Some interesting notes on color spaces:
https://bottosson.github.io/posts/oklab/
https://raphlinus.github.io/color/2021/01/18/oklab-critique.html
"""

from numpy import (asarray, array, where, tensordot, newaxis, cbrt, sqrt,
                   pi, sin, cos, arctan2)
from numpy.linalg import inv


class W3CColor(object):
    # If rgb, lab, etc. are array, leading dimesion is color, shape (3, ...).
    def __init__(self, rgb=None, lab=None, xyz=None, rgb255=None, hex=None,
                 lch=None):
        if rgb255 is not None:
            rgb = asarray(rgb255, float) / 255.
        elif hex is not None:
            hex = asarray(hex)
            if hex.kind in ("U", "S"):
                hex = self.str2int(hex)
            rgb = hex[newaxis].repeat(3, axis=0)
            rgb[0] >>= 16
            rgb[1] >>= 8
            rgb &= 0xff
        elif lch is not None:
            l, c, h = asarray(lch, float)
            lab = [l, c*cos(pi/180.*h), c*sin(pi/180.*h)]
        if xyz is not None:
            xyz = asarray(xyz, float)  # Assume D50 adapted XYZ
        elif rgb is not None:
            xyz = self._rgb2xyz(rgb)
        elif lab is not None:
            xyz = self._lab2xyz(lab)
        else:
            raise TypeError("must supply one of rgb, lab, xyz, rgb255, hex")
        self._xyz = xyz  # D50 adapted XYZ

    # White points
    _d50 = array([0.3457/0.3585, 1.00000, (1.0 - 0.3457 - 0.3585)/0.3585])
    _d65 = array([0.3127/0.3290, 1.00000, (1.0 - 0.3127 - 0.3290)/0.3290])

    @staticmethod
    def str2int(x):
        x = asarray(x, str)  # converts "S" to "U" if needed
        shape = x.shape
        return array([int(s, 0) for s in x.ravel()]).reshape(shape)

    @staticmethod
    def int2str(x, prefix="#"):  # default prefix is for CSS "#rrggbb"
        x = asarray(x, int)
        shape = x.shape
        return array(["{}{:06x}".format(prefix, s)
                      for s in x.ravel()]).reshape(shape)

    # W3C sRGB <--> XYZ matrices differ slightly from sRGB/BT.709 standard
    # See https://en.wikipedia.org/wiki/SRGB
    # - these assume D65 white, the sRGB standard
    _xyz_rgb = array([[12831./3959., -329./214., -1974./3959.],
                      [-851781./878810., 1648619./878810., 36519./878810.],
                      [705./12673., -2585./12673., 705./667.]])
    _rgb_xyz = array([[506752./1228815., 87881./245763., 12673./70218.],
                      [87098./409605., 175762./245763., 12673./175545.],
                      [7918./409605.,87881./737289., 1001167./1053270.]])

    # Bradford chromatic adaptation from D65 to D50
    _d65_d50 = array([
	    [1.0479297925449969, 0.022946870601609652, -0.05019226628920524],
	    [0.02962780877005599, 0.9904344267538799, -0.017073799063418826],
	    [-0.009243040646204504, 0.015055191490298152, 0.7518742814281371]
    ])
    # Bradford chromatic adaptation from D50 to D65
    _d50_d65 = array([
        [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
	    [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
	    [0.012314014864481998, -0.020507649298898964, 1.330365926242124]
    ])

    _f2lab = array([[0., 116., 0.], [500., -500., 0.], [0., 200., -200.]])
    _lab2f = inv(_f2lab)

    @staticmethod
    def _rgb2xyz(rgb):
        rgb = array(rgb, float)  # copy rgb
        sgn = where(rgb < 0., -1., 1.)
        rgb *= sgn
        rgb = sgn * where(rgb<=0.04045, rgb/12.92, ((rgb + 0.055)/1.055)**2.4)
        # transform to XYZ with D65 white (per sRGB standard)
        xyz = tensordot(W3CColor._rgb_xyz, rgb, 1)
        return tensordot(W3CColor._d65_d50, xyz, 1)

    @staticmethod
    def _xyz2rgb(xyz):
        xyz = asarray(xyz, float)  # D50 adapted XYZ
        xyz = tensordot(W3CColor._d50_d65, xyz, 1)
        rgb = tensordot(W3CColor._xyz_rgb, xyz, 1)
        sgn = where(rgb < 0., -1., 1.)
        rgb *= sgn
        rgb = where(rgb<=0.0031308, 12.92*rgb, 1.055*rgb**(1./2.4)-0.055)
        return sgn*rgb

    @staticmethod
    def _lab2xyz(lab):
        lab = array(lab, float)  # copy
        lab[0] += 16.
        f = tensordot(W3CColor._lab2f, lab, 1)
        kap = 24389./27.  # (29/3)**3
        eps = 6./29.  # for f = ((xyz eps)*kap + 16.)/116.
        xyz = where(f>eps, f*f*f, (116.*f - 16.)/kap)
        return xyz * W3CColor._d50  # this is XYZ-D50 (not D65)

    @staticmethod
    def _xyz2lab(xyz):
        xyz = array(xyz, float) / W3CColor._d50
        eps = 216./24389.  # (6/29)**3
        kap = 24389./27.  # (29/3)**3
        f = where(xyz>eps, cbrt(xyz), (kap*xyz + 16.)/116.)
        lab = tensordot(W3CColor._f2lab, f, 1)
        lab[0] -= 16.
        return lab

    @property
    def xyz(self):
        return self._xyz  # D50 adapted XYZ

    @property
    def rgb(self):
        return self._xyz2rgb(self._xyz)

    @property
    def lab(self):
        return self._xyz2lab(self._xyz)

    @property
    def rgb255(self):
        # W3C recommends times 255 and round, not times 256 and truncate
        return (255. * self.rgb + 0.5).clip(0., 255.).astype(int)

    @property
    def hex(self):
        rgb = self.rgb255
        rgb = (rgb[0]<<16) | (rgb[1]<<8) | rgb[2]
        return self.int2str(rgb)

    @property
    def lch(self):
        l, a, b = self.lab
        c, h = sqrt(a**2 + b**2), 180./pi*arctan2(b, a)
        h = where(h<0., 360.+h, h)
        return array([l, c, h])


solarized = {}
# Values from https://ethanschoonover.com/solarized/
# name     hex                                 L a b       R G B      H S B
for line in """
base03    #002b36  8/4 brblack  234 #1c1c1c 15 -12 -12   0  43  54 193 100  21
base02    #073642  0/4 black    235 #262626 20 -12 -12   7  54  66 192  90  26
base01    #586e75 10/7 brgreen  240 #585858 45 -07 -07  88 110 117 194  25  46
base00    #657b83 11/7 bryellow 241 #626262 50 -07 -07 101 123 131 195  23  51
base0     #839496 12/6 brblue   244 #808080 60 -06 -03 131 148 150 186  13  59
base1     #93a1a1 14/4 brcyan   245 #8a8a8a 65 -05 -02 147 161 161 180   9  63
base2     #eee8d5  7/7 white    254 #e4e4e4 92 -00  10 238 232 213  44  11  93
base3     #fdf6e3 15/7 brwhite  230 #ffffd7 97  00  10 253 246 227  44  10  99
yellow    #b58900  3/3 yellow   136 #af8700 60  10  65 181 137   0  45 100  71
orange    #cb4b16  9/3 brred    166 #d75f00 50  50  55 203  75  22  18  89  80
red       #dc322f  1/1 red      160 #d70000 50  65  45 220  50  47   1  79  86
magenta   #d33682  5/5 magenta  125 #af005f 50  65 -05 211  54 130 331  74  83
violet    #6c71c4 13/5 brmagenta 61 #5f5faf 50  15 -45 108 113 196 237  45  77
blue      #268bd2  4/4 blue      33 #0087ff 55 -10 -45  38 139 210 205  82  82
cyan      #2aa198  6/6 cyan      37 #00afaf 60 -35 -05  42 161 152 175  74  63
green     #859900  2/2 green     64 #5f8700 60 -20  65 133 153   0  68 100  60
""".split("\n"):
    if not line:
        continue
    line = line.split()
    solarized[line[0]] = W3CColor(lab=array(line[6:9], int))

# https://apps.colorjs.io/convert/?color=lab(50%2065%2045)&precision=4
# red lab(50 65 45) --> #dc322f (0.863795, 0.195646, 0.185306)
# XYZ-d50 (0.329289, 0.184187, 0.0335779)
# XYZ-d65 (0.312497, 0.177392, 0.0449486)
# sRGB-lin (0.717661, 0.0317644, 0.0287096)
# cyan lab(60, -35, -5) --> #2aa198 (0.165420, 0.633031, 0.596431)
# XYZ-d50 (0.193224, 0.281233, 0.259637)
# XYZ-d65 (0.194549, 0.284026, 0.342024)
# sRGB-lin (0.0233344, 0.358471, 0.314397)


def _sol_as_sel(dark=False):
    if dark:
        conv = dict(base03="bg_0", base02="bg_1", base01="bg_2",
                    base00="dim_0", base0="fg_0", base1="fg_1",
                    base2="fg_x", base3="fg_y")
    else:
        conv = dict(base3="bg_0", base2="bg_1", base1="bg_2",
                    base0="dim_0", base00="fg_0", base01="fg_1",
                    base02="fg_x", base03="fg_y")
    conv.update(red="red", orange="orange", yellow="yellow", green="green",
                cyan="cyan", blue="blue", violet="violet", magenta="magenta")
    return {conv[key]: solarized[key] for key in solarized}


solarized_light = _sol_as_sel(False)
solarized_dark = _sol_as_sel(True)

selenized_light = {}
# Values from 
# name          L a b        H S B        hex
for line in """
bg_0         96   0  13    44  13  99   #fbf3db   #faf0d2
bg_1         91   0  13    45  13  92   #ece3cc   #e7ddc0
bg_2         82   0  13    45  15  83   #d5cdb6   #cbc2a6
dim_0        62  -4   1   155   6  60   #909995   #7e8783
fg_0         42  -6  -6   195  24  43   #53676d   #43545a
fg_1         31  -6  -6   195  30  33   #3a4d53   #2d3c42

red          46  66  42   356  84  82   #d2212d   #c00221
green        54 -40  58    90 100  57   #489100   #3f8100
yellow       59   6  71    47 100  68   #ad8900   #9b7600
blue         46   0 -60   208 100  83   #0072d4   #005dcc
magenta      52  58 -16   323  64  79   #ca4898   #b73088
cyan         57 -42  -4   175 100  61   #009c8f   #038d7c
orange       52  39  52    23  84  76   #c25d1e   #b04713
violet       49  32 -47   262  50  78   #8762c6   #714cbc

br_red       44  66  42   354  89  80   #cc1729   #b9001e
br_green     52 -40  58    92 100  55   #428b00   #3a7b00
br_yellow    57   6  71    47 100  66   #a78300   #957000
br_blue      44   0 -60   208 100  81   #006dce   #0059c6
br_magenta   50  58 -16   323  66  77   #c44392   #b12b82
br_cyan      55 -42  -4   175 100  59   #00978a   #008777
br_orange    50  39  52    23  87  74   #bc5819   #a9430f
br_violet    47  32 -47   262  51  75   #825dc0   #6b47b6
""".split("\n"):
    if not line:
        continue
    line = line.split()
    selenized_light[line[0]] = W3CColor(lab=array(line[1:4], int))

selenized_dark = {}
# Values from 
# name          L a b        H S B        hex
for line in """
bg_0         23 -12 -12   193  77  28   #103c48   #112e38
bg_1         28 -13 -13   193  72  34   #184956   #163945
bg_2         36 -13 -13   194  57  41   #2d5b69   #254a57
dim_0        56  -8  -6   191  20  56   #72898f   #61777c
fg_0         75  -5  -2   182   8  74   #adbcbc   #9faeae
fg_1         85  -5  -2   182   7  85   #cad8d9   #bfd0d0

red          60  63  40     2  68  98   #fa5750   #f13c3e
green        69 -38  55    92  70  73   #75b938   #69ad21
yellow       75   6  68    46  79  86   #dbb32d   #d1a416
blue         60   0 -57   213  72  97   #4695f7   #3a82f8
magenta      66  55 -15   325  52  95   #f275be   #e75bb3
cyan         73 -40  -4   174  67  78   #41c7b9   #42bdaa
orange       67  37  50    22  69  93   #ed8649   #e26f35
violet       64  30 -45   263  42  92   #af88eb   #9b72e9

br_red       66  63  40     3  65 100   #ff665c   #ff4b49
br_green     74 -38  55    92  65  78   #84c747   #78be2e
br_yellow    80   6  68    46  74  92   #ebc13d   #e4b424
br_blue      66   0 -57   214  66 100   #58a3ff   #4a91ff
br_magenta   72  55 -15   325  49 100   #ff84cd   #fb69c4
br_cyan      78 -40  -4   173  61  84   #53d6c7   #50cfba
br_orange    72  37  50    22  66  99   #fd9456   #f67e41
br_violet    69  30 -45   263  40  98   #bd96fa   #ab80fc
""".split("\n"):
    if not line:
        continue
    line = line.split()
    selenized_dark[line[0]] = W3CColor(lab=array(line[1:4], int))

selenized_white = {}
# Values from 
# name          L a b        H S B        hex
for line in """
bg_0        100   0   0    35   0 100   #ffffff   #ffffff
bg_1         93   0   0    35   0  92   #ebebeb   #e6e6e6
bg_2         82   0   0    35   0  80   #cdcdcd   #c2c2c2
dim_0        56   0   0    35   0  53   #878787   #747474
fg_0         30   0   0    35   0  28   #474747   #373737
fg_1         16   0   0    35   0  16   #282828   #1e1e1e

red          40  88  56   357 100  84   #d6000c   #c5000d
green        54 -53  77   108 100  59   #1d9700   #288800
yellow       65   8  95    46 100  77   #c49700   #b58400
blue         40   0 -80   214 100  89   #0064e4   #004fe0
magenta      50  77 -21   318  93  87   #dd0f9d   #cc008e
cyan         61 -56  -6   174 100  68   #00ad9c   #00a08a
orange       51  52  70    21 100  82   #d04a00   #bf3400
violet       45  42 -63   261  62  84   #7f51d6   #673ad0

br_red       33  88  56     0 100  75   #bf0000   #aa0000
br_green     47 -53  77   120 100  52   #008400   #147300
br_yellow    58   8  95    46 100  69   #af8500   #9d7100
br_blue      33   0 -80   216 100  81   #0054cf   #0040c8
br_magenta   43  77 -21   318 100  78   #c7008b   #b3007a
br_cyan      54 -56  -6   174 100  60   #009a8a   #008a77
br_orange    44  52  70    18 100  73   #ba3700   #a62300
br_violet    38  42 -63   260  67  76   #6b40c3   #542bb9
""".split("\n"):
    if not line:
        continue
    line = line.split()
    selenized_white[line[0]] = W3CColor(lab=array(line[1:4], int))

selenized_black = {}
# Values from 
# name          L a b        H S B        hex
for line in """
bg_0          8   0   0    35   0   9   #181818   #121212
bg_1         15   0   0    35   0  15   #252525   #1c1c1c
bg_2         25   0   0    35   0  23   #3b3b3b   #2d2d2d
dim_0        50   0   0    35   0  47   #777777   #636363
fg_0         75   0   0    35   0  72   #b9b9b9   #aaaaaa
fg_1         88   0   0    35   0  87   #dedede   #d6d6d6

red          56  63  40     1  70  93   #ed4a46   #e13136
green        67 -38  55    92  72  71   #70b433   #64a81d
yellow       75   6  68    46  79  86   #dbb32d   #d1a416
blue         56   0 -57   212  77  92   #368aeb   #2d76e9
magenta      64  55 -15   325  53  92   #eb6eb7   #de54ab
cyan         72 -40  -4   174  68  77   #3fc5b7   #40bba8
orange       64  37  50    22  71  90   #e67f43   #da6930
violet       60  30 -45   263  43  88   #a580e2   #9169dd

br_red       63  63  40     3  67 100   #ff5e56   #fb4343
br_green     74 -38  55    92  65  78   #83c746   #77bd2d
br_yellow    82   6  68    45  73  94   #efc541   #e9b928
br_blue      63   0 -57   214  69 100   #4f9cfe   #4289ff
br_magenta   71  55 -15   325  49 100   #ff81ca   #f767c0
br_cyan      79 -40  -4   173  60  85   #56d8c9   #53d2bd
br_orange    71  37  50    22  67  98   #fa9153   #f37b3f
br_violet    67  30 -45   263  41  96   #b891f5   #a67bf5
""".split("\n"):
    if not line:
        continue
    line = line.split()
    selenized_black[line[0]] = W3CColor(lab=array(line[1:4], int))


def dump_theme(theme):
    theme = {k: v.hex[()] for k, v in theme.items()}
    txt = """
    --bg_0: {bg_0}; --bg_1: {bg_1}; --bg_2: {bg_2};
    --dim_0: {dim_0}; --fg_0: {fg_0}; --fg_1: {fg_1};
    --red: {red}; --orange: {orange}; --yellow: {yellow};
    --green: {green}; --cyan: {cyan}; --blue: {blue};
    --violet: {violet}; --magenta: {magenta};
""".format(**theme)
    if theme.get("br_red"):
        txt += """
    --br_red: {br_red}; --br_orange: {br_orange}; --br_yellow: {br_yellow};
    --br_green: {br_green}; --br_cyan: {br_cyan}; --br_blue: {br_blue};
    --br_violet: {br_violet}; --br_magenta: {br_magenta};
""".format(**theme)
    elif theme.get("fg_x"):
        txt += """
    --fg_x: {fg_x}; --fg_y: {fg_y};
""".format(**theme)
    return txt
