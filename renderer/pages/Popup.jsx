import React, { useState, useEffect } from 'react';
import Speedometer from '../components/Speedometer';

export default function Popup() {
  const [status, setStatus] = useState('Ready');
  const [ping, setPing] = useState('--');
  const [download, setDownload] = useState('0.00');
  const [upload, setUpload] = useState('0.00');
  const [currentDialSpeed, setCurrentDialSpeed] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [activePhase, setActivePhase] = useState('Download');

  useEffect(() => {
    if (!window.api) return;

    window.api.onProgress((data) => {
      if (data.phase === 'ping' && data.status === 'done') {
        setPing(data.value);
      }

      if (data.phase === 'download') {
        setActivePhase('Download');
        setStatus('Testing Download...');
        if (data.status === 'progress' || data.status === 'done') {
          setDownload(data.speed.toFixed(2)); // Live update bottom box
          setCurrentDialSpeed(data.speed);    // Live update dial
        }
      }

      if (data.phase === 'upload') {
        setActivePhase('Upload');
        setStatus('Testing Upload...');
        if (data.status === 'progress' || data.status === 'done') {
          setUpload(data.speed.toFixed(2));   // Live update bottom box
          setCurrentDialSpeed(data.speed);    // Live update dial
        }
      }
    });

    window.api.onResult((finalData) => {
      setStatus('Test Complete');
      setIsTesting(false);
      setCurrentDialSpeed(0); // Reset dial
      setPing(finalData.ping);
      setDownload(finalData.download.toFixed(2));
      setUpload(finalData.upload.toFixed(2));
      setActivePhase('Download');
    });
  }, []);

  const handleStartTest = () => {
    setIsTesting(true);
    setStatus('Connecting...');
    setPing('--');
    setDownload('0.00');
    setUpload('0.00');
    setCurrentDialSpeed(0);
    setActivePhase('Download');
    
    window.api.runTest();
  };

  return (
    <div className="app">
      <div className="top">
        <span className="brand">ExitPing</span>
        <span id="status">{status}</span>
      </div>
      
      <div className="meter">
        <Speedometer speedValue={currentDialSpeed} />
        <div className="center">
          <div id="mainValue">
             {isTesting ? currentDialSpeed.toFixed(2) : download}
          </div>
          <div id="unit">Mbps</div>
          <div id="metricLabel">{activePhase}</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="label">DOWNLOAD</span>
          <span className="value">{download} Mbps</span>
        </div>
        <div className="stat">
          <span className="label">UPLOAD</span>
          <span className="value">{upload} Mbps</span>
        </div>
      </div>

      <div className="resultLine">
        {ping === '--' ? 'Ready to measure' : `Ping: ${ping} ms`}
      </div>

      <button onClick={handleStartTest} disabled={isTesting}>
        {isTesting ? 'Measuring...' : 'Start Test'}
      </button>
    </div>
  );
}