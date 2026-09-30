import numpy as np, glob, os
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, uniform_filter1d
SR=48000
def rd(f):
    sr,x=wavfile.read(f); x=x.astype(np.float32)/32768
    if x.ndim>1: x=x.mean(1)
    return x
S={os.path.basename(f)[:-4]:rd(f) for f in glob.glob('../sfx/efeitos/*.wav')}
voz=rd('voz.wav'); N=len(voz); mus=rd('musica.wav'); mus=np.pad(mus,(0,max(0,N-len(mus))))[:N]
cues=[(0.0,'impacto_grande',1.0),(0.75,'whoosh',.5),
 # c02 exemplo
 (2.1,'tic',.7),(2.8,'tic',.7),(3.5,'tic',.7),(4.2,'tic',.7),(5.3,'bonk',.9),(5.3,'impacto_medio',.6),
 (7.2,'tic',.7),(7.7,'tic',.7),(8.3,'tic',.7),(8.8,'tic',.7),(9.3,'tic',.7),(10.3,'impacto_grande',.7),(10.3,'flash_pop',.8),
 (12.8,'risco',.8),(14.4,'impacto_medio',.7),(15.35,'whoosh',.6),
 # c03-c05 tabela
 (15.45,'impacto_medio',.5),(16.45,'moeda_positiva',.9),(18.63,'bonk',1.0),
 (20.82,'whoosh',.6),(20.9,'impacto_medio',.45),(21.62,'moeda_positiva',.9),(22.7,'bonk',1.0),
 (24.15,'whoosh',.6),(24.25,'impacto_medio',.45),(24.95,'moeda_positiva',.9),(26.7,'bonk',1.0),
 # c06 soma
 (28.3,'whoosh',.6),(29.63,'tic',.9),(30.33,'tic',.9),(31.03,'tic',.9),(32.33,'impacto_grande',.8),(32.33,'brilho',.9),(35.33,'degraus',.8),
 # c07 shidos
 (38.8,'apito',.9),(39.13,'impacto_medio',.6),(44.57,'cartao_1',.8),(46.57,'cartao_2',.9),(48.57,'cartao_3',1.0),(50.57,'grave_forte',.7),
 (52.9,'whoosh',.5),(54.1,'chime_1',.9),(54.95,'chime_2',.9),(55.8,'chime_3',.9),(56.9,'brilho',.8),
 # c08 capitão
 (57.2,'whoosh',.7),(57.5,'botao_pop',.7),(58.0,'tic',.8),(59.2,'ka_ching',1.0),(59.2,'impacto_medio',.7),
 # c09 dica
 (61.2,'whoosh',.6),(61.4,'impacto_medio',.4),(63.1,'check',.9),(64.1,'check',.9),(65.1,'check',.9),(66.5,'check',.9),
 # c10 final
 (68.7,'whoosh',.7),(69.7,'botao_pop',.9),(69.7,'impacto_medio',.6),(70.9,'tic',.6),(74.0,'impacto_grande',1.0)]
sfx=np.zeros(N+SR*3)
for at,k,g in cues:
    i=int(at*SR); x=S[k]; sfx[i:i+len(x)]+=x*g
sfx=sfx[:N]
# ducking: envelope da voz
e=np.sqrt(uniform_filter1d(voz**2,int(SR*0.03)))
act=(20*np.log10(e+1e-9)>-36).astype(np.float32)
act=maximum_filter1d(act,int(SR*0.25))              # segura 0,25 s
act=uniform_filter1d(act,int(SR*0.12))              # suaviza ataque/libertação
act=act[:N]; gm=0.30*(1-act)+0.12*act                             # música: 30% nas pausas, 12% sob a voz
mix=voz*1.0+mus*gm+sfx*0.38
# limitador suave
peak=np.max(np.abs(mix)); mix=np.tanh(mix*1.1)/np.tanh(1.1)
wavfile.write('mix.wav',SR,(np.clip(mix,-1,1)*32767).astype(np.int16))
wavfile.write('so_musica_e_efeitos.wav',SR,(np.clip(mus*gm+sfx*0.38,-1,1)*32767).astype(np.int16))
print('ok',round(float(peak),2))
