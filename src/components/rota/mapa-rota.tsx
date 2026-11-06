'use client';

import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { PainelRota } from '@/lib/api-client';
import type { PosicaoVeiculo } from '@/models/rota.model';

// Mapa com o carro em tempo real, o trajeto de hoje, os da semana e as cidades do roteiro.
// O Leaflet é carregado só no navegador (ele precisa de "window").

const CORES = { resolvida: '#34d399', pendencia: '#fbbf24', futura: '#71717a', aqui: '#a78bfa' };

function iconeCidade(L: typeof Leaflet, cor: string, texto: string, pulsar: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="position:relative;width:30px;height:30px">
      ${pulsar ? `<span style="position:absolute;inset:-6px;border-radius:999px;background:${cor};opacity:.35;animation:pulse-soft 2s ease-in-out infinite"></span>` : ''}
      <div style="position:absolute;inset:0;display:grid;place-items:center;border-radius:999px;background:#0b0b10;border:2px solid ${cor};color:${cor};font:600 11px system-ui">${texto}</div>
    </div>`,
  });
}

function iconeCarro(L: typeof Leaflet, rumo: number, andando: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="position:relative;width:44px;height:44px">
      ${andando ? '<span style="position:absolute;inset:0;border-radius:999px;background:#38bdf8;opacity:.25;animation:pulse-soft 1.6s ease-in-out infinite"></span>' : ''}
      <div data-carro style="position:absolute;inset:6px;display:grid;place-items:center;border-radius:999px;background:linear-gradient(135deg,#0ea5e9,#6366f1);box-shadow:0 0 18px rgba(56,189,248,.6);transform:rotate(${rumo}deg);transition:transform .8s">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2l5 9h-3v11h-4V11H7z"/></svg>
      </div>
    </div>`,
  });
}

export function MapaRota({ dados, posicao, seguir }: { dados: PainelRota; posicao: PosicaoVeiculo; seguir: boolean }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const carro = useRef<Leaflet.Marker | null>(null);
  const camadas = useRef<Leaflet.LayerGroup | null>(null);
  const [pronto, setPronto] = useState(false);

  // Cria o mapa uma vez.
  useEffect(() => {
    let cancelado = false;
    import('leaflet').then((mod) => {
      if (cancelado || !caixa.current || mapa.current) return;
      L.current = mod;
      const m = mod.map(caixa.current, { zoomControl: false, attributionControl: true, preferCanvas: true });
      mod.control.zoom({ position: "bottomright" }).addTo(m);
      mod.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      }).addTo(m);
      camadas.current = mod.layerGroup().addTo(m);
      mapa.current = m;
      setPronto(true);
    });
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  // Desenha rotas e cidades quando os dados mudam.
  useEffect(() => {
    const m = mapa.current;
    const lib = L.current;
    if (!pronto || !m || !lib || !camadas.current) return;
    camadas.current.clearLayers();
    for (const trecho of dados.rotaSemana) {
      if (trecho.length > 1) lib.polyline(trecho, { color: '#8b5cf6', weight: 2, opacity: 0.35, dashArray: '4 6' }).addTo(camadas.current);
    }
    if (dados.rotaHoje.length > 1) lib.polyline(dados.rotaHoje, { color: '#38bdf8', weight: 4, opacity: 0.9 }).addTo(camadas.current);

    lib.marker([dados.base.lat, dados.base.lng], { icon: iconeCidade(lib, '#e4e4e7', '⌂', false) })
      .bindTooltip(`<b>${dados.base.nome}</b><br/>Base do escritório`)
      .addTo(camadas.current);

    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    for (const p of dados.paradas) {
      const cor = p.noLocal ? CORES.aqui : p.visitada ? (p.pendentes > 0 ? CORES.pendencia : CORES.resolvida) : CORES.futura;
      const dia = new Date(`${p.data}T12:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
      lib.marker([p.lat, p.lng], { icon: iconeCidade(lib, cor, String(p.total), p.noLocal || (p.data === hoje && !p.visitada)) })
        .bindTooltip(
          `<b>${p.cidade}/${p.uf}</b> · ${dia}<br/>${p.resolvidas} de ${p.total} pasta(s) resolvida(s)${p.visitada && p.pendentes ? `<br/><span style="color:${CORES.pendencia}">${p.pendentes} pendência(s) deixada(s)</span>` : ''}`,
        )
        .addTo(camadas.current);
    }
    const pontos: [number, number][] = [[dados.base.lat, dados.base.lng], ...dados.paradas.map((p) => [p.lat, p.lng] as [number, number])];
    m.fitBounds(lib.latLngBounds(pontos), { padding: [30, 30] });
  }, [dados, pronto]);

  // Move o carro suavemente até a nova posição.
  useEffect(() => {
    const m = mapa.current;
    const lib = L.current;
    if (!pronto || !m || !lib) return;
    const destino = lib.latLng(posicao.lat, posicao.lng);
    if (!carro.current) {
      carro.current = lib.marker(destino, { icon: iconeCarro(lib, posicao.rumo, posicao.situacao === 'em_movimento'), zIndexOffset: 1000 }).addTo(m);
      return;
    }
    carro.current.setIcon(iconeCarro(lib, posicao.rumo, posicao.situacao === 'em_movimento'));
    const origem = carro.current.getLatLng();
    const inicio = performance.now();
    let quadro = 0;
    const passo = (t: number) => {
      const f = Math.min(1, (t - inicio) / 1500);
      carro.current?.setLatLng([origem.lat + (destino.lat - origem.lat) * f, origem.lng + (destino.lng - origem.lng) * f]);
      if (f < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    if (seguir) m.panTo(destino, { animate: true, duration: 1.2 });
    return () => cancelAnimationFrame(quadro);
  }, [posicao, pronto, seguir]);

  return <div ref={caixa} className="h-full w-full bg-[#0b0b10]" />;
}
