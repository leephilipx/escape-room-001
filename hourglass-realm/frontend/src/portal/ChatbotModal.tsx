import React, { useState, useRef, useEffect } from 'react';
import { Modal, Button, Row, Col, message } from 'antd';
import { CheckOutlined, DeleteOutlined, LockOutlined, UploadOutlined } from '@ant-design/icons';
import './ChatbotModal.css';
import { API_BASE_URL, CHATBOT_MESSAGES } from '../utils/constants';
import ImageTreasureGuardian from '../assets/images/avatar-treasure-guardian.jpg';

interface ChatbotModalProps {
  visible: boolean;
  onClose: () => void;
  progressCount: number;
  pins: string[];
  portalToken: string;
}

const ChatbotModal: React.FC<ChatbotModalProps> = ({ visible, onClose, progressCount, pins, portalToken }) => {
  const [displayedPins, setDisplayedPins] = useState<string[]>([]);
  const [botMessage, setBotMessage] = useState<string>('');
  const [userImage, setUserImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const puzzleComplete = (pins.length == 2);

  // Track PINs
  useEffect(() => {
    setDisplayedPins(pins);
  }, [pins]);

  // Initialize canvas
  useEffect(() => {
    if (visible && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [visible]);

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getCanvasCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getCanvasCoordinates(e, canvas);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!drawing) return;
    setDrawing(false);
    setUserImage(canvasRef.current?.toDataURL('image/png') || null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setUserImage(null);
  };

  // Helper function to get correct canvas coordinates
  const getCanvasCoordinates = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
      canvas: HTMLCanvasElement
    ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    // Account for device pixel ratio
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Submit image to backend
  const submitImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas && !userImage) {
      messageApi.error('Please provide an image first');
      return;
    }
    let imageToSend = userImage;
    if (!imageToSend && canvas) {
      imageToSend = canvas.toDataURL('image/png');
    }
    if (!imageToSend) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/chatbot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${portalToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_data: imageToSend,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setBotMessage(data.response);
        setCanReset(true);
        setUserImage(null);
      } else {
        messageApi.error('Failed to process image');
      }
    } catch (error) {
      messageApi.error('Error submitting image');
    } finally {
      setLoading(false);
    }
  };

  // Reset for next round
  const handleReset = () => {
    setBotMessage('');
    setUserImage(null);
    setCanReset(false);
    clearCanvas();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      title="Treasure Guardian"
      open={visible}
      onCancel={handleClose}
      width={900}
      footer={null}
      className="chatbot-modal"
    >
      {contextHolder}

      {/* Progress Icons */}
      <div className="progress-icons">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`progress-icon ${i < progressCount ? 'active' : ''}`}
          >
            {(i<progressCount) ? <CheckOutlined /> : <LockOutlined />}
          </div>
        ))}
      </div>

      {/* PINs Display */}
      {pins.length > 0 && (
        <div className="pin-display-container">
          {displayedPins.map((pin, index) => (
            <div
              key={index}
              className={`pin-card ${index < displayedPins.length - 1 ? 'expired' : ''}`}
            >
              <div className="pin-label">
                {index < 1 ? 'Unlocked PIN' : 'True PIN'}
              </div>
              <div className={`pin-number ${index < displayedPins.length - 1 ? 'expired' : ''}`}>
                {pin}
              </div>
            </div>
          ))}
        </div>
      )}

      <Row gutter={24} style={{ marginTop: 24 }}>
        {/* Bot Message - Left */}
        <Col xs={24} md={12}>
          <div className="bot-message-container">
            <div className="bot-avatar">
              <img src={ImageTreasureGuardian} alt="Treasure Guardian" />
            </div>
            <div className="bot-message">
              {CHATBOT_MESSAGES[pins.length]}
            </div>
          </div>
          {botMessage && (
            <div className="bot-message-container">
              <div className="bot-avatar">
                <img src={ImageTreasureGuardian} alt="Treasure Guardian" />
              </div>
              <div className="bot-message">
                {botMessage}
              </div>
            </div>
          )}
        </Col>

        {/* Image Input - Right */}
        <Col xs={24} md={12}>
          <div className="input-container">
            <div className="canvas-container">
              <canvas
                ref={canvasRef}
                width={300}
                height={300}
                className="draw-canvas"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{
                  touchAction: 'none', // Prevent scrolling while drawing
                  opacity: (loading || canReset || puzzleComplete) ? 0.5 : 1,
                  pointerEvents: (loading || canReset || puzzleComplete) ? 'none' : 'auto',
                }}
              />
            </div>

            <div className="action-buttons">
              {!canReset ? (
                <>
                  <Button
                    type="primary"
                    icon={<DeleteOutlined />}
                    onClick={clearCanvas}
                    disabled={!userImage || loading || puzzleComplete}
                  >
                    Clear
                  </Button>
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={submitImage}
                    loading={loading}
                    disabled={!userImage || puzzleComplete}
                  >
                    Submit
                  </Button>
                </>
              ) : (
                <Button
                  type="primary"
                  onClick={handleReset}
                  block
                  size="large"
                >
                  New Drawing
                </Button>
              )}
            </div>
          </div>
        </Col>
      </Row>
    </Modal>
  );
};

export default ChatbotModal;