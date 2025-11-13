import React, { useState, useEffect } from 'react';
import { Input, Button, Card, Form, message, Spin, Row, Col, DatePicker, Divider } from 'antd';
import { CloudDownloadOutlined, CloudUploadOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { API_BASE_URL } from '../utils/constants';
import './Portal.css'
import './Admin.css'

dayjs.extend(utc);
dayjs.extend(timezone);

interface AdminData {
  active_token: string | null;
  token_claim_time: string | null;
  target_time: string;
  hints: string[];
  master_codes: {
    passphrase: string;
    puzzle_1b_pins: string[],
  }
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
  const [loadingReset, setLoadingReset] = useState(false);
  const [displayJson, setDisplayJson] = useState('');

  // Form fields
  const [targetTime, setTargetTime] = useState<dayjs.Dayjs>(dayjs());
  const [hints, setHints] = useState<string[]>([]);
  const [newHint, setNewHint] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [puzzle1bPins, setPuzzle1bPins] = useState<string[]>([]);
  

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
          master_codes: {
            passphrase: passphrase,
            puzzle_1b_pins: puzzle1bPins.map(h => h.trim()).filter(h => h)
          }
        }
      });
    }
  }, [targetTime, hints, passphrase, puzzle1bPins]);

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
      setPassphrase(data.master_codes.passphrase);
      setPuzzle1bPins(data.master_codes.puzzle_1b_pins);
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
      puzzle_1b_pins: puzzle1bPins
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
      setPassphrase(data.master_codes.passphrase);
      setPuzzle1bPins(data.master_codes.puzzle_1b_pins);
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

  // Reset updated data
  const handleReset = async () => {
    if (!adminPassphrase.trim()) {
      messageToast.error('Please enter admin passphrase');
      return;
    }
    const isConfirmed = window.confirm(
      'Warning: This will reset all game data. This action cannot be undone. Are you sure?'
    );
    if (!isConfirmed) {
      return;
    }
    setLoadingReset(true);
    try {
      const response = await fetch(`${API_BASE_URL}/reset`, {
        method: 'POST',
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
      setPassphrase(data.master_codes.passphrase);
      setPuzzle1bPins(data.master_codes.puzzle_1b_pins);
      messageToast.success('Game data reset successfully');
    } catch (error) {
      messageToast.error(`Failed to reset game data: ${error}`);
    } finally {
      setLoadingReset(false);
    }
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

      <div className="main-content admin-content">
        <Card title="Admin Control Panel">
          <Spin spinning={loadingGet || loadingPost || loadingReset}>
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
              <Row gutter={[24, 12]}>
                <Col xs={24} sm={!adminData ? 24 : 12}>
                  <Button
                    style={{ width: '100%' }}
                    type="primary"
                    icon={<CloudDownloadOutlined />}
                    onClick={handleGet}
                  >
                    GET Admin Data
                  </Button>
                </Col>
                {adminData && (
                  <Col xs={24} sm={12}>
                    <Button
                      style={{ width: '100%' }}
                      type="primary"
                      icon={<CloudUploadOutlined />}
                      onClick={handlePost}
                    >
                      POST Updated Data
                    </Button>
                  </Col>
                )}
              </Row>
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
                  <Col xs={24}>
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
                </Row>

                <Divider size={'small'} />

                <Row gutter={[24, 24]}>
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
                  {/* Puzzle 1B PINs */}
                  <Col xs={24} sm={12}>
                    <Card type="inner" size="small" title="Puzzle 1B PINs">
                      <Input.TextArea
                        value={puzzle1bPins.join('\n')}
                        onChange={(e) => setPuzzle1bPins(e.target.value.split('\n'))}
                        placeholder="One PIN per line"
                        rows={2}
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      />
                    </Card>
                  </Col>                
                </Row>

                <Divider size={'small'} />

                <Row gutter={[24, 24]}>
                  {/* Hints */}
                  <Col xs={24}>
                    <Card type="inner" size="small" title="Hints">
                      <span style={{ marginBottom: '8px', display: 'block'}}>Add New Hint:</span>
                      <Input.Group style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
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
                      <span style={{ marginBottom: '8px', display: 'block' }}>All Hints:</span>
                      <Input.TextArea
                        value={hints.join('\n')}
                        onChange={(e) => setHints(e.target.value.split('\n'))}
                        placeholder="One hint per line"
                        rows={6}
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Divider size={'small'} />

                <Row gutter={[24, 12]}>
                  <Col xs={24}>
                    <Button
                      style={{ width: '100%' }}
                      type="primary"
                      icon={<CloudUploadOutlined />}
                      onClick={handlePost}
                    >
                      Save All Changes
                    </Button>
                  </Col>
                    <Col xs={24}>
                    <Button
                      style={{ width: '100%' }}
                      type="primary"
                      icon={<WarningOutlined />}
                      onClick={handleReset}
                      className="reset-button"
                    >
                      Reset Game Data
                    </Button>
                  </Col>
                </Row>
              </Card>
            )}
          </Spin>
        </Card>
      </div>
    </div>
  );
};

export default AdminPanel;