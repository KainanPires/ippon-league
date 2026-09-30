import numpy as np, os
from scipy.io import wavfile
from scipy.signal import butter, lfilter
SR=48000
rng=np.random.default_rng(7)
def t(d): return np.arange(int(SR*d))/SR
def env(n,a=0.003,dec=0.3):
    x=np.arange(n)/SR; e=np.minimum(x/a,1)*np.exp(-x/dec); return e
def lp(x,f): b,a=butter(2,f/(SR/2),'low'); return lfilter(b,a,x)
def hp(x,f): b,a=butter(2,f/(SR/2),'high'); return lfilter(b,a,x)
def bp(x,f1,f2): b,a=butter(2,[f1/(SR/2),f2/(SR/2)],'band'); return lfilter(b,a,x)
def norm(x,g=0.9): return x/np.max(np.abs(x)+1e-9)*g
def noise(d): return rng.standard_normal(int(SR*d))
def sweep(f0,f1,d): tt=t(d); f=f0*(f1/f0)**(tt/d); return np.sin(2*np.pi*np.cumsum(f)/SR)
S={}
# taiko / grande impacto
d=1.6; x=sweep(110,38,d)*env(int(SR*d),0.002,0.45)*1.2 + lp(noise(d),900)*env(int(SR*d),0.001,0.08)*0.8 + lp(noise(d),200)*env(int(SR*d),0.01,0.6)*0.5
S['impacto_grande']=norm(np.tanh(x*1.5))
d=0.9; x=sweep(160,55,d)*env(int(SR*d),0.002,0.22)+lp(noise(d),1500)*env(int(SR*d),0.001,0.04)*0.6
S['impacto_medio']=norm(np.tanh(x*1.3),0.8)
d=1.2; x=sweep(70,30,d)*env(int(SR*d),0.002,0.5)*1.3+lp(noise(d),120)*env(int(SR*d),0.02,0.8)
S['grave_forte']=norm(np.tanh(x*1.6))
d=2.5; x=lp(noise(d),90)*np.minimum(t(d)/0.3,1)*np.exp(-t(d)/1.2)
S['rumble']=norm(x,0.7)
# tic, bonk
d=0.08; x=bp(noise(d),2500,6000)*env(int(SR*d),0.0005,0.012)+np.sin(2*np.pi*2200*t(d))*env(int(SR*d),0.0005,0.01)*0.5
S['tic']=norm(x,0.5)
d=0.25; x=np.sin(2*np.pi*140*t(d))*env(int(SR*d),0.002,0.06)+lp(noise(d),600)*env(int(SR*d),0.001,0.02)*0.4
S['bonk']=norm(x,0.6)
# sinos
def bell(f,d=1.5,g=0.6):
    tt=t(d); x=sum(np.sin(2*np.pi*f*m*tt)*a*np.exp(-tt/(dd)) for m,a,dd in [(1,1,.9),(2.76,.5,.4),(5.4,.25,.2),(8.93,.12,.1)])
    return norm(x*np.minimum(tt/0.002,1),g)
S['ding_medalha']=bell(1320,2.0,0.6)
S['moeda_positiva']=norm(np.concatenate([bell(1568,0.12,1)[:int(SR*.07)],bell(2093,0.6,1)]),0.5)
S['check']=norm(np.concatenate([bell(988,0.1,1)[:int(SR*.08)],bell(1480,0.5,1)]),0.45)
def asc(fs):
    return norm(np.concatenate([bell(f,0.35,1)[:int(SR*.33)] for f in fs]),0.5)
S['chime_1']=bell(1047,0.9,0.5); S['chime_2']=bell(1319,0.9,0.5); S['chime_3']=bell(1568,1.0,0.55)
# whoosh
d=0.6; tt=t(d); n=noise(d); f=300*(12**(tt/d)); y=np.zeros_like(n); 
for i in range(0,len(n),480):
    seg=n[i:i+480]; y[i:i+480]=bp(seg,max(80,f[i]*0.6),min(20000,f[i]*1.4)) if len(seg)>20 else seg
x=y*np.sin(np.pi*tt/d)**2
S['whoosh']=norm(x,0.55)
# glitch
d=0.35; x=np.sign(np.sin(2*np.pi*(80+400*rng.random())*t(d)))*(rng.random(int(SR*d))>0.3)
x=x*np.repeat(rng.random(int(d*40))>0.4,int(SR/40))[:len(x)] if len(np.repeat(rng.random(int(d*40))>0.4,int(SR/40)))>=len(x) else x
S['glitch']=norm(hp(x,300)*np.exp(-t(d)/0.3),0.4)
# risco (caneta)
d=0.4; x=bp(noise(d),1500,5000)*(0.6+0.4*np.sin(2*np.pi*30*t(d)))*np.sin(np.pi*t(d)/d)
S['risco']=norm(x,0.45)
# flash pop
d=0.2; x=hp(noise(d),3000)*env(int(SR*d),0.0005,0.03)+sweep(900,300,d)*env(int(SR*d),0.001,0.04)*.5
S['flash_pop']=norm(x,0.6)
# apito de árbitro (dois tons com trinado)
d=0.9; tt=t(d); tr=1+0.5*(np.sin(2*np.pi*28*tt)>0)
x=(np.sin(2*np.pi*2900*tt)+0.6*np.sin(2*np.pi*3350*tt))*(0.7+0.3*tr)+0.2*bp(noise(d),2500,4000)
x*=np.minimum(tt/0.02,1)*np.minimum((d-tt)/0.08,1)
S['apito']=norm(x,0.45)
# cartão a cair (whoosh curto + impacto)
S['cartao_1']=norm(np.concatenate([S['whoosh'][int(SR*.3):]*0.6,S['impacto_medio']*0.7]),0.6)
S['cartao_2']=norm(np.concatenate([S['whoosh'][int(SR*.3):]*0.6,S['impacto_medio']*0.9]),0.75)
S['cartao_3']=norm(np.concatenate([S['whoosh'][int(SR*.3):]*0.6,S['impacto_grande']*0.9]),0.9)
# degraus
S['degraus']=norm(np.concatenate([np.concatenate([S['tic']*1.0,np.zeros(int(SR*.1))]) for _ in range(3)]),0.45)
# ka-ching
x=np.concatenate([lp(noise(0.08),3000)*env(int(SR*.08),0.001,0.02),bell(2637,0.9,1)+bell(3520,0.9,.7)*0.6])
S['ka_ching']=norm(x,0.6)
# botão pop
d=0.15; x=np.sin(2*np.pi*(500+2000*t(d))*t(d))*env(int(SR*d),0.001,0.03)
S['botao_pop']=norm(x,0.5)
# brilho
x=sum(bell(f,0.8,1)*0.3 for f in [2637,3136,3951])
S['brilho']=norm(x,0.35)
os.makedirs('efeitos',exist_ok=True)
for k,v in S.items(): wavfile.write(f'efeitos/{k}.wav',SR,(v*32767).astype(np.int16))
# faixa única sincronizada a 72,21 s
cues=[(0.0,'impacto_grande'),(1.0,'ding_medalha'),(2.3,'glitch'),(6.8,'whoosh')]
cues+=[(10.0+i*0.45,'tic') for i in range(14)]
cues+=[(12.7,'bonk'),(17.8,'impacto_grande'),(17.8,'flash_pop'),(20.0,'risco'),(21.0,'whoosh')]
cues+=[(22.0,'whoosh'),(22.4,'moeda_positiva'),(25.2,'bonk'),(27.4,'whoosh'),(28.2,'moeda_positiva'),(29.7,'bonk'),(30.4,'whoosh'),(31.2,'moeda_positiva'),(32.7,'bonk')]
cues+=[(34.1,'tic'),(34.9,'tic'),(35.6,'tic'),(37.1,'impacto_medio'),(37.1,'brilho'),(40.1,'degraus')]
cues+=[(42.3,'apito'),(46.0,'cartao_1'),(47.5,'cartao_2'),(49.7,'cartao_3'),(51.2,'grave_forte'),(51.2,'rumble'),(54.9,'chime_1'),(55.7,'chime_2'),(56.4,'chime_3')]
cues+=[(57.9,'whoosh'),(59.4,'ka_ching'),(59.4,'impacto_medio'),(61.6,'check'),(62.3,'check'),(63.1,'check'),(64.6,'check'),(66.8,'botao_pop'),(66.8,'whoosh'),(71.0,'impacto_grande')]
L=int(SR*72.21); mix=np.zeros(L+SR*3)
for at,k in cues:
    i=int(at*SR); v=S[k]; mix[i:i+len(v)]+=v*0.8
mix=mix[:L]; mix=norm(np.tanh(mix),0.85)
wavfile.write('trilha-de-efeitos_72s.wav',SR,(mix*32767).astype(np.int16))
open('mapa.txt','w').write('\n'.join(f'{int(a//60)}:{a%60:05.2f}  {k}' for a,k in sorted(cues)))
print(len(S),'efeitos;',len(cues),'marcas')
