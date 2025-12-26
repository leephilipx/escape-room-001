import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, FloatButton, message, Spin, Card, Row, Col, Statistic, Drawer } from 'antd';
import { BulbOutlined, FieldTimeOutlined, LockOutlined, QuestionOutlined, RiseOutlined } from '@ant-design/icons';

import ChatbotModal from './ChatbotModal';
import { setCookie, getCookie } from '../utils/cookie';
import { API_BASE_URL, POLL_INTERVAL } from '../utils/constants';
import { resolvePathwithBase } from '../utils/shared';
import './Portal.css';
import '../styles/antd-override.css';
import '../styles/background.css';
import '../styles/glitch.css';
import audioFileJourney from '../assets/audio/journey.mp3';
import audioFileAdrift from '../assets/audio/adriftamonginfinitestars.mp3';

interface GameData {
  remaining_time: string;
  hints: string[];
  puzzle_1b: {
    count: number;
    pins: string[];
  },
  complete: boolean;
}

type PortalState = 'welcome' | 'main' | 'completed';

const Portal: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [messageToast, messageContextHolder] = message.useMessage();
  const [portalState, setPortalState] = useState<PortalState>((getCookie("portalState") as PortalState) || "welcome");
  const [portalToken, setPortalToken] = useState<string>(getCookie("portalToken") || '');
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('00:00:00');
  const [passphrase, setPassphrase] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousHintsCountRef = useRef<number>(0);

  // Persist portal state and token for 1 hour
  useEffect(() => {
    setCookie("portalState", portalState, 60);
    setCookie("portalToken", portalToken, 60);
  }, [portalState, portalToken]);

  // Detect completion stage
  useEffect(() => {
    if (gameData?.complete) {
      setUnlocked(true);
    }
  }, [gameData?.complete]);

  // Detect hints increase
  useEffect(() => {
    if (gameData?.hints) {
      const currentHintsCount = gameData.hints.length;
      const previousHintsCount = previousHintsCountRef.current;
      if (currentHintsCount > previousHintsCount) {
        const newHintsCount = currentHintsCount - previousHintsCount;
        messageToast.info(`New hint${newHintsCount > 1 ? 's' : ''} available!`);
      }
      previousHintsCountRef.current = currentHintsCount;
    }
  }, [gameData?.hints, messageToast]);

  // Enter the game
  const handleEnter = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/enter`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setPortalState('main');
        setPortalToken(data.portalToken);
      } else {
        messageToast.error('Failed to enter the realm');
      }
    } catch (error) {
      messageToast.error('Connection error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch game data
  const fetchGameData = async (currentToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/data`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });
      if (response.ok) {
        const data: GameData = await response.json();
        setGameData(data);
        audioRef.current?.play();
      } else if (response.status === 403 || response.status === 401) {
        // Session expired or invalid
        setPortalState('welcome');
        setPortalToken('');
        messageToast.warning('Your session has ended');
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  // Calculate remaining time with jitter
  const calculateTimeRemaining = (targetTime: string, offset: number) => {
    const target = new Date(targetTime).getTime();
    const now = new Date().getTime();
    const diff = target - now + offset * 1000;
    if (diff <= 0) {
      return '00:00:00';
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Poll for updates
  useEffect(() => {
    if (portalToken && portalState === 'main') {
      fetchGameData(portalToken);
      pollIntervalRef.current = setInterval(() => {
        fetchGameData(portalToken);
      }, POLL_INTERVAL);
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [portalToken, portalState]);

  // Update countdown timer
  useEffect(() => {
    if (gameData?.remaining_time) {
      const updateTimer = () => {
        const randomJitter = Math.floor((1.0-Math.random()) * 60); // -30 to 30 seconds
        const time = gameData.complete ? '00:00:00' : calculateTimeRemaining(gameData.remaining_time, randomJitter);
        setTimeRemaining(time);
      };
      updateTimer();
      countdownIntervalRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      };
    }
  }, [gameData?.remaining_time]);

  // Handle passphrase unlock
  const handleUnlock = async () => {
    if (!portalToken) return;
    setLoading(true);
    if (unlocked) {
      setPortalState('completed');
      setLoading(false);
      setPortalToken('');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${portalToken}`,
        },
        body: JSON.stringify({ passphrase }),
      });
      if (response.ok) {
        setUnlocked(true);
        setPortalState('completed');
        setPortalToken('');
      } else {
        messageToast.error('Incorrect passphrase');
      }
    } catch (error) {
      messageToast.error('Connection error');
      console.error(error);
    } finally {
      setPassphrase('');
      setLoading(false);
    }
  };

  // Dev: Clear cookies to reset state
  // const devClearCookies = () => {
  //   setCookie('portalState', 'welcome', -1);
  //   setCookie('portalToken', '', -1);
  //   messageToast.success('[Dev] Cookies cleared');
  //   window.location.reload();
  // };

  // Welcome Screen
  if (portalState === 'welcome') {
    return (
      <div className="welcome-container">
        {messageContextHolder}
        <div className="image-background"></div>
        <div className="particles-background">
          {[...Array(50)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }} />
          ))}
        </div>

        <div className="welcome-content">
          <div className="portal-glow"></div>
          <h1 className="welcome-title">Hourglass Realm</h1>
          <div className="welcome-text">
            <p>Welcome, seekers of fortune and wisdom. You stand at gates of the Hourglass Realm, where treasures and secrets are scattered across the sands of time.</p>
            <p style={{ color: "#6496c8", fontWeight: 800, letterSpacing: -1}}>Only one seeker may enter the portal at a time.</p>
          </div>
          <Button
            type="primary"
            size="large"
            onClick={handleEnter}
            loading={loading}
            className="enter-button"
          >
            ENTER
          </Button>
        </div>

        {/* Credits Button */}
        {unlocked && (
          <FloatButton
            type="default"
            tooltip="Credits"
            href={resolvePathwithBase("credits")}
            target='_blank'
            shape="circle"
            icon={<QuestionOutlined />}
            className="credits-button"
          >
            Credits
          </FloatButton>
        )}
      </div>
    );
  }

  // Main Game Screen
  if (portalState === 'main' && portalToken) {
    return (
      <div className="main-container">
        {messageContextHolder}
        <audio
          ref={audioRef}
          src={unlocked ? audioFileJourney : audioFileAdrift}
          autoPlay
          loop
        />
        <div className="image-background"></div>
        <div className="particles-background">
          {[...Array(30)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }} />
          ))}
        </div>

        <div className="main-content">
          <h2 className="main-title">The Hourglass Realm</h2>
          <div className="welcome-text-small">
            <p>Around you lie hints, fragments, and symbols — some small, some grand. Some may guide you to wealth, influence, and status; others may point to the things that make life meaningful.</p>
          </div>

          {/* Timer Section */}
          <Card className="timer-card glitch-content">
            <Statistic
              title="The Brevity of Life"
              value={timeRemaining}
              prefix={<div><FieldTimeOutlined />&nbsp;</div>}
              valueStyle={{ color: '#ffd700', fontSize: '2.5em', fontFamily: 'monospace' }}
            />
          </Card>

          {/* Passphrase Section */}
          {(gameData?.puzzle_1b?.pins.length == 2) && (
            <Card className="passphrase-card">
              <h3>Wisdom Gateway</h3>
              <Input
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value.toUpperCase())}
                onPressEnter={handleUnlock}
                disabled={unlocked}
                prefix={<LockOutlined />}
                size="large"
              />
              <Button
                type="primary"
                block
                onClick={handleUnlock}
                loading={loading}
                style={{ marginTop: 16 }}
              >
                {unlocked ? '✓ Gateway Unlocked' : 'Unlock'}
              </Button>
            </Card>
          )}

          <div className="welcome-text-small">
            <p>Time is short, and every moment counts. Work together, observe carefully, and gather what seems valuable — only then will the final gateway reveal itself.</p>
          </div>

          {/* Action Buttons */}
          <Row gutter={16} style={{ marginTop: 24 }}>
            <Col xs={12}>
              <Button
                block
                icon={<BulbOutlined />}
                onClick={() => setShowHints(true)}
                size="large"
              >
                Request Hint
              </Button>
            </Col>
            <Col xs={12}>
              <Button
                type="primary"
                block
                icon={<RiseOutlined />}
                onClick={() => setShowChatbot(true)}
                size="large"
              >
                Treasure Guardian
              </Button>
            </Col>
          </Row>
          
          {/* Dev: Clear Cookies Button */}
          {/* <br/>
          <Button
            type="primary"
            block
            size="small"
            onClick={devClearCookies}
          >
            CLEAR COOKIES
          </Button> */}
        </div>

        {/* Hints Drawer */}
        <Drawer
          title="Request Hint"
          placement="bottom"
          onClose={() => setShowHints(false)}
          open={showHints}
          height={300}
        >
          <div style={{ marginBottom: 16 }}>
            <h4 style={{marginBottom: 10}}>Recent Hints:</h4>
            {gameData?.hints && gameData.hints.length > 0 ? (
              <ol className="hints-list">
                {gameData.hints.map(hint => <li>{hint}</li>)}
              </ol>
            ) : (
              <p>No hints yet. Request one from the gamemaster if you are stuck!</p>
            )}
          </div>
        </Drawer>
        
        {/* Chatbot Modal */}
        <ChatbotModal
          visible={showChatbot}
          onClose={() => setShowChatbot(false)}
          progressCount={gameData?.puzzle_1b?.count || 0}
          pins={gameData?.puzzle_1b?.pins || []}
          portalToken={portalToken}
        />

        {/* Credits Button */}
        {unlocked && (
            <FloatButton
              type="default"
              tooltip="Credits"
              href={resolvePathwithBase("credits")}
              target='_blank'
              shape="circle"              
              icon={<QuestionOutlined />}
              className="credits-button"
            >
              Credits
            </FloatButton>
          )}
      </div>
    );
  }

  // Completion Screen
  if (portalState === 'completed') {
    return (
      <div className="welcome-container">
        {messageContextHolder}
        <audio
          ref={audioRef}
          src={audioFileJourney}
          autoPlay
          loop
        />
        <div className="image-background"></div>
        <div className="particles-background">
          {[...Array(50)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }} />
          ))}
        </div>

        <div className="welcome-content">
          <div className="portal-glow"></div>
          <h1 className="welcome-title">Hourglass Realm</h1>
          <div className="welcome-text">
            <p>The sands of time settle once more. You sought fortune and wisdom, and along the way found teamwork, insight, and meaning.</p>
            <p>Yet remember — all earthly treasures fade. The true and eternal treasures lie beyond this realm.</p>
            <p style={{ color: "#64c867ff", fontWeight: 800, letterSpacing: -1}}>Thank you, seekers. The Hourglass Realm will remember your light.</p>
          </div>

          <Button
            type="primary"
            size="large"
            onClick={() => setPortalState('welcome')}
            className="enter-button"
          >
            Back to Reality
          </Button>

          {/* Credits Button */}
          {unlocked && (
            <FloatButton
              type="default"
              tooltip="Credits"
              href={resolvePathwithBase("credits")}
              target='_blank'
              shape="circle"
              icon={<QuestionOutlined />}
              className="credits-button"
            >
              Credits
            </FloatButton>
          )}
        </div>
      </div>
    );
  }

  return <Spin />;
};

export default Portal;