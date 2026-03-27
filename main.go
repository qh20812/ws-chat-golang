package main

import (
	"fmt"
	"main/src/auth"
	"main/src/chat"
	"main/src/common"
	"main/src/friend"
	"main/src/user"

	"github.com/gin-gonic/gin"
)

func main() {
	common.LoadEnv()

	db := common.ConnectMongoDB()

	userRepo := user.NewRepository(db)
	userCtrl := user.NewController(userRepo)
	authCtrl := auth.NewController(userRepo)

	friendRepo := friend.NewRepository(db)
	friendCtrl := friend.NewController(friendRepo)

	go chat.WS.Run()

	r := gin.Default()

	r.GET("/", func(ctx *gin.Context) {
		ctx.String(200, "Welcome to my chat realtime")
	})
	r.POST("/api/register", userCtrl.Register)
	r.POST("/api/login", authCtrl.Login)
	r.PATCH("/api/user", auth.JWTMiddleware(), userCtrl.UpdateUser)
	r.POST("/api/friend/request", auth.JWTMiddleware(), friendCtrl.SendRequest)
	r.POST("/api/friend/accept", auth.JWTMiddleware(), friendCtrl.AcceptRequest)
	r.POST("/api/friend/refuse", auth.JWTMiddleware(), friendCtrl.RefuseRequest)
	r.GET("/api/friend/list", auth.JWTMiddleware(), friendCtrl.ListFriends)
	r.GET("/ws", chat.ServerWS)

	port := common.GetEnv("PORT")
	fmt.Println("Server is running at http://localhost" + port)
	r.Run(port)
}
