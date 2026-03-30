package callsignal

import (
	"encoding/json"
	"main/src/chat"
)

func SignalMessages(c *chat.Client) {
	defer func() {
		// khi client ngắt kết nối, xóa userid khỏi danh sách signaling clients va đóng kết nối
		delete(signalingClients, c.UserID)
		c.Conn.Close()
	}()

	for {
		_, msg, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		// parse json tu client thanh SignalPayload
		var signal SignalPayload
		if err := json.Unmarshal(msg, &signal); err != nil {
			continue
		}

		targetClient, ok := signalingClients[signal.ToUserID]
		if ok {
			targetMsg := map[string]any{
				"from": c.UserID,
				"type": signal.Type,
				"data": signal.Data,
			}

			out, _ := json.Marshal(targetMsg)
			targetClient.Send <- out
		} else {
			// neu khong tim thay target client, co the gui thong bao ve client gui signal
			out, _ := json.Marshal(map[string]any{
				"to_user_id is not connected": signal.ToUserID,
			})
			c.Send <- out
		}
	}
}
