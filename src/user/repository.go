package user

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	Collection *mongo.Collection
}



func NewRepository(db *mongo.Database) *Repository {
	collection := db.Collection("users")
	if err := CreateUserIndexes(collection); err != nil {
		panic(err)
	}

	return &Repository{
		Collection: collection,
	}
}

func (r *Repository) Create(user *User) error {
	user.CreatedAt = time.Now()

	_, err := r.Collection.InsertOne(context.TODO(), user)
	if err != nil {
		return err
	}
	return nil
}

func (r *Repository) FindByEmail(email string) (*User, error) {
	var user User
	err := r.Collection.FindOne(context.TODO(), bson.M{"email": email}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) FindByUsername(username string) (*User, error) {
	var user User
	err := r.Collection.FindOne(context.TODO(), bson.M{"username": username}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) FindByUsernameOrEmail(query string) (*User, error) {
	var user User
	filter := bson.M{"$or": []bson.M{{"username": query}, {"email": query}}}
	err := r.Collection.FindOne(context.TODO(), filter).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func CreateUserIndexes(collection *mongo.Collection) error {
	names, err := collection.Indexes().CreateMany(context.TODO(), []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "username", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	})
	if err != nil {
		return err
	}
	fmt.Println("Created indexes:", names)
	return nil
}

func (r *Repository) UpdateUser(userID bson.ObjectID, update bson.M) error {
	if len(update) == 0 {
		return nil
	}

	_, err := r.Collection.UpdateByID(context.TODO(), userID, bson.M{"$set": update})
	return err
}

func (r *Repository) FindByID(id bson.ObjectID) *User {
	var u User
	err := r.Collection.FindOne(context.TODO(), bson.M{"_id": id}).Decode(&u)
	if err != nil {
		return nil
	}
	return &u
}

func (r *Repository) FindManyByID(ids []bson.ObjectID) []User {
	var users []User
	cursor, _ := r.Collection.Find(context.TODO(), bson.M{"_id": bson.M{"$in": ids}})
	defer cursor.Close(context.TODO())
	cursor.All(context.TODO(), &users)
	return users
}
