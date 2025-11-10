import React, { useState, useEffect } from 'react';
import { Input, Button, Space, Card, Form, message, Modal, Spin, Row, Col, DatePicker } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { API_BASE_URL } from '../utils/constants';
import './Portal.css'

dayjs.extend(utc);
dayjs.extend(timezone);

interface AdminData {
  active_token: string | null;
  token_claim_time: string | null;
  target_time: string;
  hints: string[];
  passphrase: string;
  puzzle_1b: {
    stage1_progress: Record<string, boolean>;
    stage1_count: number;
    completed_stage: number;
    pins: string[];
  };
}

const AdminPanel: React.FC = () => {
  const [messageToast, messageContextHolder] = message.useMessage();
  const [adminPassphrase, setAdminPassphrase] = useState('');
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loadingGet, setLoadingGet] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const [displayJson, setDisplayJson] = useState('');

  // Form fields
  const [targetTime, setTargetTime] = useState<dayjs.Dayjs>(dayjs());
  const [hints, setHints] = useState<string[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [newHint, setNewHint] = useState('');

  useEffect(() => {
    if (!adminData) setDisplayJson('');
    else setDisplayJson(JSON.stringify(adminData, null, 2));
  }, [adminData]);

  useEffect(() => {
    if (adminData) {
      setAdminData(prevState => {
        if (!prevState) return null;
        return {
          ...prevState,
          target_time: targetTime.toISOString().slice(0,-1) + '000+00:00',
          hints: hints.map(h => h.trim()).filter(h => h),
          passphrase: passphrase
        }
      });
    }
  }, [targetTime, hints, passphrase]);

  // Fetch admin data
  const handleGet = async () => {
    if (!adminPassphrase.trim()) {
      messageToast.error('Please enter admin passphrase');
      return;
    }
    setLoadingGet(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminPassphrase}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: AdminData = await response.json();
      setAdminData(data);
      setTargetTime(dayjs(data.target_time));
      setHints(data.hints);
      setPassphrase(data.passphrase);
      messageToast.success('Admin data loaded successfully');
    } catch (error) {
      messageToast.error(`Failed to fetch admin data: ${error}`);
    } finally {
      setLoadingGet(false);
    }
  };

  // Post updated data
  const handlePost = async () => {
    if (!adminPassphrase.trim()) {
      messageToast.error('Please enter admin passphrase');
      return;
    }
    if (!adminData) {
      messageToast.error('Please fetch admin data first');
      return;
    }
    const updatedData = {
      target_time: adminData.target_time,
      hints: hints,
      passphrase: passphrase,
    };
    setLoadingPost(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminPassphrase}`,
        },
        body: JSON.stringify(updatedData),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: AdminData = await response.json();
      setTargetTime(dayjs(data.target_time));
      setHints(data.hints);
      setPassphrase(data.passphrase);
      messageToast.success('Admin data updated successfully');
    } catch (error) {
      messageToast.error(`Failed to update admin data: ${error}`);
    } finally {
      setLoadingPost(false);
    }
  };

  // Append hint
  const appendHint = () => {
    if (!newHint.trim()) {
      messageToast.warning('Please enter a hint');
      return;
    }
    setHints((prev) => [...prev, newHint.trim()]);
    setNewHint('');
    messageToast.success('Hint appended');
  };

  return (
    <div className="main-container">
      {messageContextHolder}
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
        <Card title="Admin Control Panel">
          <Spin spinning={loadingGet}>
            {/* 1. Admin Passphrase */}
            <Card type="inner" title="1. Admin Authentication" style={{ marginBottom: '24px' }}>
              <Form layout="vertical">
                <Form.Item label="Admin Passphrase" required>
                  <Input.Password
                    placeholder="Enter admin passphrase"
                    value={adminPassphrase}
                    onChange={(e) => setAdminPassphrase(e.target.value)}
                    onPressEnter={handleGet}
                  />
                </Form.Item>
              </Form>
            </Card>

            {/* 2. GET and POST Buttons */}
            <Card type="inner" title="2. Data Operations" style={{ marginBottom: '24px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleGet}
                  loading={loadingGet}
                >
                  GET Admin Data
                </Button>
                <Button
                  type="primary"
                  danger
                  icon={<UploadOutlined />}
                  onClick={handlePost}
                  loading={loadingPost}
                  disabled={!adminData}
                >
                  POST Updated Data
                </Button>
              </Space>
            </Card>

            {/* 3. JSON Display */}
            {displayJson && (
              <Card type="inner" title="3. Current Admin Data (Read-Only)" style={{ marginBottom: '24px' }}>
                <Input.TextArea
                  value={displayJson}
                  readOnly
                  rows={12}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    backgroundColor: '#f5f5f5',
                  }}
                />
              </Card>
            )}

            {/* 4. Edit Fields */}
            {adminData && (
              <Card type="inner" title="4. Edit Admin Data">
                <Row gutter={[24, 24]}>
                  {/* Target Time */}
                  <Col xs={24} sm={12}>
                    <Card type="inner" size="small" title="Target Time">
                      <DatePicker
                        showTime
                        value={targetTime}
                        onChange={(date) => setTargetTime(date)}
                        style={{ width: '100%' }}
                        format="YYYY-MM-DD HH:mm:ss"
                      />
                    </Card>
                  </Col>

                  {/* Passphrase */}
                  <Col xs={24} sm={12}>
                    <Card type="inner" size="small" title="Passphrase">
                      <Input
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value.toUpperCase())}
                        placeholder="Enter new passphrase"
                      />
                    </Card>
                  </Col>

                  {/* Hints */}
                  <Col xs={24}>
                    <Card type="inner" size="small" title="Hints">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <div>
                          <span style={{ marginRight: '8px' }}>Add New Hint:</span>
                          <Input.Group compact style={{ display: 'flex', gap: '8px' }}>
                            <Input
                              style={{ flex: 1 }}
                              placeholder="Enter a hint"
                              value={newHint}
                              onChange={(e) => setNewHint(e.target.value)}
                              onPressEnter={appendHint}
                            />
                            <Button type="primary" onClick={appendHint}>
                              Append
                            </Button>
                          </Input.Group>
                        </div>
                        <div>
                          <span style={{ marginBottom: '8px', display: 'block' }}>All Hints:</span>
                          <Input.TextArea
                            value={hints.join('\n')}
                            onChange={(e) => setHints(e.target.value.split('\n'))}
                            placeholder="One hint per line"
                            rows={6}
                            style={{ fontFamily: 'monospace', fontSize: '12px' }}
                          />
                        </div>
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Space style={{ marginTop: '24px' }}>
                  <Button type="primary" danger icon={<UploadOutlined />} onClick={handlePost}>
                    Save All Changes
                  </Button>
                  <Button onClick={handleGet}>Reload Data</Button>
                </Space>
              </Card>
            )}
          </Spin>
        </Card>
      </div>
    </div>
  );
};

export default AdminPanel;