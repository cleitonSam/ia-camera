'use client';

import { useState, useRef, useEffect } from 'react';

export default function CameraApp() {
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user');
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null); // This was missing!
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setMounted(true);
    
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    setIsMobile(isMobileDevice);
    setIsIOS(isIOSDevice);
    
    if (!isMobileDevice) {
      setFacingMode('user');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Seu navegador não suporta acesso à câmera.');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setError('');
      setIsLoading(true);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      console.log('🎥 Obtendo acesso à câmera...');
      
      const constraints = {
        video: {
          width: { ideal: isMobile ? 1280 : 640 },
          height: { ideal: isMobile ? 720 : 480 },
          facingMode: isMobile ? facingMode : undefined,
          ...(isIOS && {
            aspectRatio: 16/9,
            frameRate: { ideal: 30 }
          })
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Stream obtido:', stream);
      
      streamRef.current = stream;
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (videoRef.current) {
        const video = videoRef.current;
        
        console.log('📺 Configurando vídeo para exibição...');
        
        // Configurações específicas para iOS
        if (isIOS) {
          video.setAttribute('webkit-playsinline', 'true');
          video.setAttribute('playsinline', 'true');
        }
        
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.controls = false;
        
        // Promise para aguardar carregamento completo
        const waitForVideo = new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            console.log('📐 Metadata carregada:', {
              width: video.videoWidth,
              height: video.videoHeight,
              readyState: video.readyState
            });
            resolve();
          };
        });
        
        video.oncanplay = () => {
          console.log('▶️ Vídeo pode reproduzir');
        };
        
        video.onplaying = () => {
          console.log('🎬 Vídeo está reproduzindo!');
        };
        
        video.onerror = () => {
          console.error('❌ Erro no vídeo');
        };
        
        // Aguardar metadata e tentar reproduzir
        await waitForVideo;
        
        console.log('🎬 Tentando reproduzir...');
        try {
          await video.play();
          console.log('✅ Reprodução iniciada com sucesso!');
        } catch (playError) {
          console.warn('⚠️ Play automático falhou:', playError);
          
          // Para iOS, força um play adicional após um delay
          if (isIOS) {
            setTimeout(async () => {
              try {
                await video.play();
                console.log('🍎 Play iOS com delay funcionou!');
              } catch (retryError) {
                console.warn('⚠️ Retry iOS falhou:', retryError);
              }
            }, 500);
          }
        }
      }
      
      console.log('🚀 Ativando câmera...');
      setIsStreamActive(true);
      setIsLoading(false);
      
    } catch (err: unknown) {
      console.error('❌ Erro:', err);
      let errorMessage = 'Erro ao acessar câmera';
      const error = err as Error;
      
      if (error.message?.includes('Device in use') || error.message?.includes('in use')) {
        errorMessage = 'Câmera está sendo usada por outro aplicativo. Feche outras abas/apps e tente novamente.';
      } else if (error.message?.includes('Permission denied') || error.message?.includes('NotAllowedError')) {
        errorMessage = 'Permissão negada. Clique no ícone da câmera na barra do navegador e permita o acesso.';
      } else if (error.message?.includes('NotFoundError')) {
        errorMessage = 'Nenhuma câmera encontrada. Verifique se há uma câmera conectada.';
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreamActive(false);
  };

  const forceReleaseCamera = async () => {
    console.log('🔧 FORÇANDO LIBERAÇÃO COMPLETA DA CÂMERA...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Track parada:', track.kind);
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
    
    setIsStreamActive(false);
    setError('');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Câmera liberada, pronto para nova conexão');
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) {
      setError('Câmera não está disponível');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      setError('Erro ao processar imagem');
      return;
    }

    if (video.videoWidth === 0) {
      video.srcObject = null;
      setTimeout(() => {
        video.srcObject = streamRef.current;
        video.play();
      }, 100);
      
      setTimeout(() => {
        performCapture(video, canvas, context);
      }, 1000);
    } else {
      performCapture(video, canvas, context);
    }
  };

  const performCapture = async (video: HTMLVideoElement, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);
    
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    if (imageDataUrl && imageDataUrl !== 'data:,') {
      setCapturedImage(imageDataUrl);
      console.log('📸 Foto capturada:', imageDataUrl.substring(0, 100) + '...');
      
      await sendToWebhook(imageDataUrl);
    } else {
      setError('Erro ao capturar imagem');
    }
  };

  const sendToWebhook = async (base64Image: string) => {
    try {
      setIsSending(true);
      console.log('🔗 Enviando imagem para webhook do n8n...');
      
      const response = await fetch('https://webhooks.moveefit.com.br/webhook/imagem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          timestamp: new Date().toISOString(),
          device: isMobile ? 'mobile' : 'desktop',
          dimensions: {
            width: videoRef.current?.videoWidth || 0,
            height: videoRef.current?.videoHeight || 0
          }
        })
      });

      if (response.ok) {
        console.log('✅ Imagem enviada com sucesso para o webhook!');
        const responseData = await response.json().catch(() => ({}));
        console.log('📄 Resposta do webhook:', responseData);
      } else {
        console.error('❌ Erro ao enviar para webhook:', response.status, response.statusText);
        setError(`Erro ao enviar imagem: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Erro na requisição para webhook:', error);
      setError('Erro de conexão com o servidor');
    } finally {
      setIsSending(false);
    }
  };

  const switchCamera = async () => {
    if (!isMobile) return;
    
    console.log('🔄 Trocando câmera...');
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacingMode);
    
    if (isStreamActive) {
      // Para iOS, precisamos de um delay maior
      const delay = isIOS ? 800 : 100;
      
      stopCamera();
      
      // Limpar completamente o vídeo no iOS
      if (isIOS && videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load();
      }
      
      setTimeout(async () => {
        await startCamera();
        
        // Para iOS, força um refresh adicional após trocar
        if (isIOS) {
          setTimeout(() => {
            forceVideoReconnect();
          }, 1000);
        }
      }, delay);
    }
  };

  const downloadImage = () => {
    if (!capturedImage) return;
    
    const link = document.createElement('a');
    link.download = `moveefit-photo-${new Date().getTime()}.jpg`;
    link.href = capturedImage;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setError('');
  };

  const refreshCamera = () => {
    forceReleaseCamera();
  };

  const forceVideoReconnect = async () => {
    console.log('🔧 FORÇANDO RECONEXÃO COMPLETA...');
    
    if (videoRef.current && streamRef.current) {
      const video = videoRef.current;
      const stream = streamRef.current;
      
      // Parar completamente
      video.pause();
      video.srcObject = null;
      
      // Para iOS, usar load() para limpar estado
      if (isIOS) {
        video.load();
      }
      
      console.log('🔄 Aguardando limpeza...');
      await new Promise(resolve => setTimeout(resolve, isIOS ? 1000 : 500));
      
      console.log('🔗 Reconectando stream...');
      
      // Configurar novamente para iOS
      if (isIOS) {
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('playsinline', 'true');
      }
      
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      
      // Para iOS, aguardar metadata antes de tentar play
      if (isIOS) {
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            console.log('📱 iOS metadata recarregada');
            resolve();
          };
          video.load();
        });
      } else {
        video.load();
      }
      
      video.onloadeddata = () => {
        console.log('📊 Dados carregados');
      };
      
      video.oncanplaythrough = () => {
        console.log('✅ Pode reproduzir completamente');
      };
      
      try {
        await video.play();
        console.log('🎬 SUCESSO: Vídeo reproduzindo!');
      } catch {
        console.warn('⚠️ Play automático falhou, criando botão manual...');
        
        const playBtn = document.createElement('button');
        playBtn.innerText = isIOS ? '🍎 Toque para Ver Câmera' : '▶️ Clique para Ver Câmera';
        playBtn.style.cssText = `
          position: absolute; 
          top: 50%; 
          left: 50%; 
          transform: translate(-50%, -50%);
          z-index: 1000;
          padding: 1rem 2rem;
          background: #e53e3e;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1.2rem;
          cursor: pointer;
          touch-action: manipulation;
        `;
        
        video.parentElement?.appendChild(playBtn);
        
        playBtn.onclick = async () => {
          try {
            await video.play();
            console.log('🎉 SUCESSO COM INTERAÇÃO: Vídeo reproduzindo!');
            playBtn.remove();
          } catch (playErr) {
            console.error('❌ Falha mesmo com interação:', playErr);
          }
        };
      }
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">📱</div>
            <h1>MoveeFit Camera</h1>
          </div>
          <p className="subtitle">Capture suas fotos com qualidade profissional</p>
        </div>
      </header>

      <main className="main-content">
        {isSending && (
          <div className="sending-message">
            <span className="loading-spinner"></span>
            <span>Enviando imagem para o servidor...</span>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <div className="error-content">
              <span>{error}</span>
              {error.includes('sendo usada') || error.includes('Device in use') ? (
                <div className="error-actions">
                  <button onClick={refreshCamera} className="retry-btn">
                    🔄 Tentar Novamente
                  </button>
                  <button onClick={forceReleaseCamera} className="force-btn">
                    🔧 Forçar Liberação
                  </button>
                </div>
              ) : (
                <button onClick={() => setError('')} className="retry-btn">
                  🔄 Tentar Novamente
                </button>
              )}
            </div>
            <button onClick={() => setError('')} className="error-close">×</button>
          </div>
        )}

        <div className="camera-container">
          {!isStreamActive && !capturedImage ? (
            <div className="welcome-section">
              <div className="welcome-icon">📷</div>
              <h2>Bem-vindo ao MoveeFit Camera</h2>
              <p>Clique no botão abaixo para ativar a câmera e capturar fotos incríveis</p>
              <button 
                onClick={startCamera}
                disabled={isLoading}
                className="start-camera-btn"
              >
                {isLoading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Ativando câmera...
                  </>
                ) : (
                  <>
                    <span>📸</span>
                    Ativar Câmera
                  </>
                )}
              </button>
            </div>
          ) : capturedImage ? (
            <div className="photo-preview">
              <h2>Foto Capturada</h2>
              <div className="photo-container">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedImage} alt="Foto capturada" className="captured-photo" />
              </div>
              <div className="photo-actions">
                <button onClick={retakePhoto} className="retake-btn">
                  <span>🔄</span>
                  Tirar Nova Foto
                </button>
                <button onClick={downloadImage} className="download-btn">
                  <span>💾</span>
                  Baixar Foto
                </button>
              </div>
            </div>
          ) : (
            <div className="camera-view">
              <div className="video-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="camera-video"
                />
                
                <div className="camera-overlay">
                  <div className="camera-frame"></div>
                </div>

                <div className="camera-controls">
                  {isMobile && (
                    <button onClick={switchCamera} className="control-btn secondary">
                      <span>🔄</span>
                    </button>
                  )}
                  
                  <button 
                    onClick={forceVideoReconnect}
                    className="control-btn secondary"
                    title="Forçar visualização"
                  >
                    <span>🔧</span>
                  </button>
                  
                  <button onClick={takePhoto} className="capture-btn" disabled={isSending}>
                    {isSending ? (
                      <>
                        <span className="loading-spinner"></span>
                      </>
                    ) : (
                      <span className="capture-icon">📸</span>
                    )}
                  </button>
                  
                  <button onClick={stopCamera} className="control-btn secondary">
                    <span>❌</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden-canvas" />
      </main>

      <footer className="app-footer">
        <p>MoveeFit Camera - Tecnologia para o seu movimento</p>
        <p className="device-info">
          {isMobile ? '📱 Dispositivo móvel' : '💻 Desktop'}
        </p>
      </footer>
    </div>
  );
}