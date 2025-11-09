import React from 'react';
import { Button, Input, Modal, message, Card, Form, InputNumber } from 'antd';
import './Portal.css';
import { API_BASE_URL, ADMIN_TOKEN } from '../utils/constants';

const Admin: React.FC = () => {
const [adminForm] = Form.useForm();

  // Admin functions
  const handleAdminReset = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/reset`, {
        method: 'POST',
        headers: {
          Authorization: ADMIN_TOKEN,
        },
      });
      if (response.ok) {
        message.success('Game reset successfully');
        // setPortalToken('');
        // setPortalState('welcome');
        // setUnlocked(false);
        // setPassphrase('');
      } else {
        message.error('Admin reset failed');
      }
    } catch (error) {
      message.error('Connection error');
      console.error(error);
    }
  };

  const handleAdminSetTime = async (values: { minutes: number }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/set_time`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ADMIN_TOKEN,
        },
        body: JSON.stringify({ minutes_from_now: values.minutes }),
      });
      if (response.ok) {
        message.success('Time updated');
        adminForm.resetFields();
      } else {
        message.error('Failed to set time');
      }
    } catch (error) {
      message.error('Connection error');
      console.error(error);
    }
  };

  const handleAdminSendHint = async (hint: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/send_hint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ADMIN_TOKEN,
        },
        body: JSON.stringify({ hint }),
      });
      if (response.ok) {
        message.success('Hint sent');
      } else {
        message.error('Failed to send hint');
      }
    } catch (error) {
      message.error('Connection error');
      console.error(error);
    }
  };

  return (
      <Modal
        title="Admin Panel"
        open={true}
        // onCancel={() => setShowAdmin(false)}
        footer={null}
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Reset Game */}
          <Card title="Reset Game">
            <Button danger block onClick={handleAdminReset}>
              Reset All Sessions
            </Button>
          </Card>

          {/* Set Time */}
          <Card title="Set Time Remaining">
            <Form
              form={adminForm}
              layout="vertical"
              onFinish={handleAdminSetTime}
            >
              <Form.Item
                name="minutes"
                label="Minutes from now"
                rules={[{ required: true, message: 'Please enter minutes' }]}
              >
                <InputNumber min={1} max={120} />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                Set Time
              </Button>
            </Form>
          </Card>

          {/* Send Hint */}
          <Card title="Send Hint">
            <Input.TextArea
              placeholder="Enter hint text..."
              rows={3}
              id="hint-input"
            />
            <Button
              type="primary"
              block
              style={{ marginTop: 8 }}
              onClick={() => {
                const hintInput = document.getElementById('hint-input') as HTMLTextAreaElement;
                if (hintInput?.value) {
                  handleAdminSendHint(hintInput.value);
                  hintInput.value = '';
                }
              }}
            >
              Send Hint
            </Button>
          </Card>

          {/* <Button onClick={() => setShowAdmin(false)} block>
            Close
          </Button> */}
        </div>
      </Modal>
    );
  };

export default Admin;