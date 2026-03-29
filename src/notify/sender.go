package notify

import "encoding/json"

func SendToUser(userID string, content string) {
	msg := map[string]string{
		"type":    "notification",
		"message": content,
	}
	data, _ := json.Marshal(msg)
	NotifyWS.Broadcast<-&NotifyPayload{
		UserID: userID,
		Message: data,
	}
}