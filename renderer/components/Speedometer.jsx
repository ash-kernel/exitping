import { useEffect, useRef } from 'react';

export class SpeedometerLogic {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext("2d");
    this.value = 0;
    this.target = 0;
    this.max = 100;
    
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.loop();
  }

  resize() {
    this.canvas.width = 180;  // Smaller width
    this.canvas.height = 180; // Smaller height
  }

  setValue(v) {
    this.target = v;
  }

  drawArc() {
    const ctx = this.ctx;
    const center = 90; // Half of 180
    ctx.clearRect(0, 0, 180, 180);
    ctx.beginPath();
    ctx.arc(center, center, 70, Math.PI, 2 * Math.PI); // Radius shrunk to 70
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 8; // Slightly thinner line
    ctx.stroke();
  }

  drawNeedle(value) {
    const ctx = this.ctx;
    const center = 90;
    const angle = Math.PI + (value / this.max) * Math.PI;
    const x = center + 60 * Math.cos(angle); // Needle length shrunk to 60
    const y = center + 60 * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#00d4ff";
    ctx.fill();
  }

  loop() {
    const animate = () => {
      this.value += (this.target - this.value) * 0.08;
      this.drawArc();
      this.drawNeedle(this.value);
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }
}

export default function Speedometer({ speedValue }) {
  const canvasRef = useRef(null);
  const meterInstance = useRef(null);

  useEffect(() => {
    if (canvasRef.current && !meterInstance.current) {
      meterInstance.current = new SpeedometerLogic(canvasRef.current);
    }
    return () => {
      if (meterInstance.current && meterInstance.current.animationId) {
        cancelAnimationFrame(meterInstance.current.animationId);
      }
    };
  }, []);

  useEffect(() => {
    if (meterInstance.current) {
      meterInstance.current.setValue(speedValue || 0);
    }
  }, [speedValue]);

  return (
    <div className="meter">
      <canvas id="speedometer" ref={canvasRef}></canvas>
    </div>
  );
}