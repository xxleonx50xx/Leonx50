<?php
// ===== Buzón de compras para Cuadra (Hostinger / PHP) =====
// POST  inbox.php   {token, monto, comercio, tarjeta, fecha?}  → guarda la compra
// GET   inbox.php?token=XXXX                                   → devuelve y vacía las pendientes
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '[]', true) ?: $_POST;
$token = $_GET['token'] ?? ($body['token'] ?? '');
if (!preg_match('/^[A-Za-z0-9]{16,64}$/', $token)) { http_response_code(401); echo '{"error":"token"}'; exit; }

$dir = __DIR__ . '/inbox-data';
if (!is_dir($dir)) { mkdir($dir, 0700, true); file_put_contents("$dir/.htaccess", "Require all denied\nDeny from all\n"); }
$file = $dir . '/' . hash('sha256', $token) . '.json';
$fp = fopen($file, 'c+');
flock($fp, LOCK_EX);
$items = json_decode(stream_get_contents($fp) ?: '[]', true) ?: [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $items[] = [
    'monto' => substr((string)($body['monto'] ?? $body['amount'] ?? ''), 0, 32),
    'comercio' => substr((string)($body['comercio'] ?? $body['merchant'] ?? ''), 0, 120),
    'tarjeta' => substr((string)($body['tarjeta'] ?? $body['card'] ?? ''), 0, 80),
    'fecha' => substr((string)($body['fecha'] ?? date('Y-m-d')), 0, 10),
    'id' => bin2hex(random_bytes(6)),
  ];
  $items = array_slice($items, -200);
  $out = ['ok' => true, 'pendientes' => count($items)];
} else {
  $out = ['items' => $items];
  $items = [];
}
ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($items)); flock($fp, LOCK_UN); fclose($fp);
echo json_encode($out);
