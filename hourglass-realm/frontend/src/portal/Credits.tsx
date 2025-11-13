import React from 'react';
import { Card, Space, Typography, Row, Col } from 'antd';

const { Text, Paragraph } = Typography;

import './Portal.css'
import './Credits.css'

const Credits: React.FC = () => {

  return (
    <div className="main-container">
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

      <div className="main-content credits-content">
        <Card title="Credits" style={{ marginBottom: '24px' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Row gutter={[24, 12]}>
              <Col xs={24} sm={6}>
                <Text strong>Storyline:</Text>
              </Col>
              <Col xs={24} sm={18}>
                <Text>ChatGPT</Text>
              </Col>
            </Row>
            <Row gutter={[24, 12]}>
              <Col xs={24} sm={6}>
                <Text strong>Intro Video:</Text>
              </Col>
              <Col xs={24} sm={18}>
                <Text>Veo 3.1, Lyria 2, Clipchamp</Text>
              </Col>
            </Row>
            <Row gutter={[24, 12]}>
              <Col xs={24} sm={6}>
                <Text strong>Hourglass Realm Portal:</Text>
              </Col>
              <Col xs={24} sm={18}>
                <Text>AWS, Imagen 4, ChatGPT, Claude Haiku 4.5</Text>
              </Col>
            </Row>
            <Row gutter={[24, 12]}>
              <Col xs={24} sm={6}>
                <Text strong>Audio Tracks:</Text>
              </Col>
              <Col xs={24} sm={18}>
                <Text>Adrift Among Infinite Stars by Scott Buckley (CC-BY-4.0), Journey by Roa (CC-BY-4.0)</Text>
              </Col>
            </Row>
          </Space>
        </Card>

        <Paragraph style={{ marginTop: '24px', textAlign: 'center' }}>
          <Text>Made with ❤️ by &copy; Philip 2025</Text>
        </Paragraph>
      </div>
    </div>
  );
};

export default Credits;