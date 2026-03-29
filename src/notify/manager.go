package notify

import (
	"main/src/chat"
	"sync"
)

type NotifyHub struct {
	Clients    map[string]map[*chat.Client]bool
	Register   chan *chat.Client
	UnRegister chan *chat.Client
	Broadcast  chan *NotifyPayload
	mu         sync.Mutex
}

type NotifyPayload struct {
	UserID  string
	Message []byte
}

var NotifyWS = NewNotifyHub()

func NewNotifyHub() *NotifyHub {
	return &NotifyHub{
		Clients:    make(map[string]map[*chat.Client]bool),
		Register:   make(chan *chat.Client),
		UnRegister: make(chan *chat.Client),
		Broadcast:  make(chan *NotifyPayload),
	}
}

func (h *NotifyHub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			if h.Clients[client.UserID] == nil {
				h.Clients[client.UserID] = make(map[*chat.Client]bool)
			}
			h.Clients[client.UserID][client] = true
			h.mu.Unlock()

		case client := <-h.UnRegister:
			h.mu.Lock()
			if clients := h.Clients[client.UserID]; clients != nil {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					if len(clients) == 0 {
						delete(h.Clients, client.UserID)
					}
				}
			}
			h.mu.Unlock()

		case payload := <-h.Broadcast:
			h.mu.Lock()
			if clients := h.Clients[payload.UserID]; clients != nil {
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
