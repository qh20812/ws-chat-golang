package chat

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	Conn   *websocket.Conn
	UserID string
	RoomID string
	Send   chan []byte
}

type Hub struct {
	Clients    map[string]map[*Client]bool
	Register   chan *Client
	UnRegister chan *Client
	Broadcast  chan *MessagePayload
	mu         sync.Mutex
}

type MessagePayload struct {
	RoomID  string
	Message []byte
}

var WS = NewHub()

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[string]map[*Client]bool),
		Register:   make(chan *Client),
		UnRegister: make(chan *Client),
		Broadcast:  make(chan *MessagePayload),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			if h.Clients[client.RoomID] == nil {
				h.Clients[client.RoomID] = make(map[*Client]bool)
			}
			h.Clients[client.RoomID][client] = true
			h.mu.Unlock()

		case client := <-h.UnRegister:
			h.mu.Lock()
			if clients := h.Clients[client.RoomID]; clients != nil {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					if len(clients) == 0 {
						delete(h.Clients, client.RoomID)
					}
				}
			}
			h.mu.Unlock()

		case payload := <-h.Broadcast:
			h.mu.Lock()
			if clients := h.Clients[payload.RoomID]; clients != nil {
				for client := range clients {
					select {
					case client.Send <- payload.Message:
					default:
						close(client.Send)
						delete(clients, client)
					}
				}
			}
			h.mu.Unlock()
		}
	}
}
