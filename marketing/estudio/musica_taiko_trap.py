import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter
SR=48000; DUR=74.72; N=int(SR*DUR)
rng=np.random.default_rng(3)
def lp(x,f): b,a=butter(2,f/(SR/2),'low'); return lfilter(b,a,x)
def hp(x,f): b,a=butter(2,f/(SR/2),'high'); return lfilter(b,a,x)
def bp(x,f1,f2): b,a=butter(2,[f1/(SR/2),f2/(SR/2)],'band'); return lfilter(b,a,x)
def T(d): return np.arange(int(SR*d))/SR
BPM=100; BEAT=60/BPM; S16=BEAT/4
# instrumentos
def kick():
    t=T(0.6); f=48+120*np.exp(-t*28); ph=2*np.pi*np.cumsum(f)/SR
    return np.tanh(2*np.sin(ph)*np.exp(-t*5.5))*0.9
def k808():
    t=T(1.1); f=45+80*np.exp(-t*30); ph=2*np.pi*np.cumsum(f)/SR
    return np.tanh(1.6*np.sin(ph)*np.exp(-t*2.2))*0.8
def snare():
    t=T(0.3); n=bp(rng.standard_normal(len(t)),1200,7000)*np.exp(-t*18); b=np.sin(2*np.pi*190*t)*np.exp(-t*25)
    return (n*0.8+b*0.5)*0.7
def clap():
    t=T(0.25); n=bp(rng.standard_normal(len(t)),900,5000); e=np.zeros_like(t)
    for o in [0,0.011,0.022]: e+=np.where(t>=o,np.exp(-(t-o)*60),0)
    e+=np.where(t>=0.03,np.exp(-(t-0.03)*14),0)*0.6
    return n*e*0.5
def hat(o=False):
    t=T(0.25 if o else 0.05); return hp(rng.standard_normal(len(t)),7000)*np.exp(-t*(12 if o else 90))*0.28
def taiko():
    t=T(0.9); f=70+60*np.exp(-t*15); ph=2*np.pi*np.cumsum(f)/SR
    body=np.sin(ph)*np.exp(-t*4); skin=lp(rng.standard_normal(len(t)),700)*np.exp(-t*25)
    return np.tanh(1.8*(body+skin*0.6))*0.8
def koto(freq,d=1.4,g=0.35):  # Karplus-Strong
    n=int(SR*d); L=int(SR/freq); buf=rng.uniform(-1,1,L); out=np.zeros(n)
    for i in range(n):
        out[i]=buf[i%L]; buf[i%L]=0.996*0.5*(buf[i%L]+buf[(i+1)%L])
    return lp(out,4000)*g
def pad(freqs,d):
    t=T(d); x=sum(np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*f*2.005*t) for f in freqs)
    env=np.minimum(t/0.6,1)*np.minimum((d-t)/0.6,1); return lp(x,1400)*env*0.05
def bass(freq,d):
    t=T(d); x=np.tanh(1.5*np.sin(2*np.pi*freq*t)); return lp(x,300)*np.exp(-t*1.5)*0.35
# escala hirajoshi em Ré: D E F A Bb
D=146.83; esc=[D,164.81,174.61,220.0,233.08,293.66,329.63,349.23,440.0]
KIT={'k':kick(),'8':k808(),'s':snare(),'c':clap(),'h':hat(),'o':hat(True),'t':taiko()}
KOTO={i:koto(f) for i,f in enumerate(esc)}
mus=np.zeros(N+SR*3)
def put(x,at,g=1.0):
    i=int(at*SR)
    if i<0 or i>=N: return
    mus[i:i+len(x)]+=x[:len(mus)-i]*g
# secções: (início, fim, intensidade 0-4, modo)
sec=[(0.0,5.3,1,'tens'),(5.3,10.3,2,'build'),(10.3,12.8,4,'drop'),(12.8,15.35,2,'groove'),
     (15.35,28.3,1,'groove'),(28.3,32.33,2,'rise'),(32.33,34.8,4,'drop'),(34.8,38.3,2,'groove'),
     (38.3,39.0,0,'cut'),(39.0,50.57,3,'dark'),(50.57,52.9,0,'rumble'),(52.9,57.2,2,'relief'),
     (57.2,59.2,0,'pause'),(59.2,61.2,3,'groove'),(61.2,68.7,1,'calm'),(68.7,74.72,4,'final')]
bar=BEAT*4
for a,b,lvl,mode in sec:
    t=a
    # grade de 16 avos alinhada à grelha global
    i0=int(np.ceil(a/S16)); i1=int(b/S16)
    for i in range(i0,i1):
        tt=i*S16; st=i%16
        if mode in('cut','rumble','pause'): continue
        if mode=='tens':
            if st in(0,8): put(KIT['t'],tt,0.35)
            if st%4==2: put(KIT['h'],tt,0.6)
        elif mode=='dark':
            if st in(0,): put(KIT['8'],tt,0.9); put(KIT['t'],tt,0.9)
            if st==8: put(KIT['t'],tt,0.7)
            if st==12: put(KIT['c'],tt,0.6)
            if st%4==0: put(KIT['h'],tt,0.35)
        elif mode=='calm':
            if st==0: put(KIT['k'],tt,0.55)
            if st==8: put(KIT['c'],tt,0.35)
            if st%4==2: put(KIT['h'],tt,0.4)
        else:
            if st in(0,10) or (lvl>=2 and st==7): put(KIT['k'],tt,0.8)
            if lvl>=3 and st==0: put(KIT['8'],tt,0.7)
            if st in(4,12) and lvl>=2: put(KIT['c'],tt,0.7); put(KIT['s'],tt,0.4)
            if st in(4,12) and lvl<2: put(KIT['c'],tt,0.45)
            if lvl>=2 or st%2==0: put(KIT['h'],tt,0.55 if st%4 else 0.8)
            if st==14 and lvl>=3: put(KIT['o'],tt,0.6)
            if lvl==4 and st in(0,6,8): put(KIT['t'],tt,0.7)
            if mode=='rise' and i1-i<16: put(KIT['s'],tt,0.25+0.6*(1-(i1-i)/16))
    # koto e harmonia por compasso
    j0=int(np.ceil(a/bar)); j1=int(b/bar)+1
    for j in range(j0,j1):
        tb=j*bar
        if tb>=b or mode in('cut','rumble','pause'): continue
        if mode=='dark': put(pad([D/2,D/2*1.19],min(bar,b-tb)),tb,1.2); put(bass(D/2,bar),tb,1.0); continue
        prog=[0,3,4,1][j%4]; root=esc[prog]/2
        put(pad([root,root*1.5,root*2],min(bar,b-tb)),tb,0.9 if lvl<3 else 1.2)
        if lvl>=1: put(bass(root/2 if root>100 else root,BEAT*2),tb,0.9); put(bass(root/2 if root>100 else root,BEAT*2),tb+BEAT*2,0.7)
        if mode in('tens','calm','relief','groove','final','drop','build'):
            pat=[0,2,4,2] if mode!='relief' else [0,2,4,6]
            for q,n in enumerate(pat):
                if tb+q*BEAT<b and (mode!='groove' or q%2==0): put(KOTO[(n+prog)%len(esc)],tb+q*BEAT,0.9 if mode!='relief' else 1.1)
# riser antes dos drops
for at in [10.3,32.33,68.7]:
    d=2.0; t=T(d); r=hp(rng.standard_normal(len(t)),1500)*(t/d)**2*0.25; put(r,at-d)
# rumble
t=T(2.3); put(lp(rng.standard_normal(len(t)),80)*np.exp(-t*0.8)*0.3,50.57)
mus=mus[:N]; mus=mus/np.max(np.abs(mus))*0.9
wavfile.write('musica.wav',SR,(mus*32767).astype(np.int16))
print('ok')
