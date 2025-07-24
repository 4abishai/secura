package com.secura.service;

import com.secura.dto.MessageRequest;
import com.secura.dto.MessageResponse;
import com.secura.entity.Message;
import com.secura.exception.UserNotFoundException;
import com.secura.repository.MessageRepository;
import com.secura.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class MessageService {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    public MessageResponse storeMessage(MessageRequest request) {
        // Validate that both sender and recipient exist
        if (!userRepository.existsById(request.getSenderId())) {
            throw new UserNotFoundException("Sender not found: " + request.getSenderId());
        }

        if (!userRepository.existsById(request.getRecipientId())) {
            throw new UserNotFoundException("Recipient not found: " + request.getRecipientId());
        }

        Message message = new Message(
                request.getSenderId(),
                request.getRecipientId(),
                request.getEncryptedMessage()
        );

        Message savedMessage = messageRepository.save(message);

        return new MessageResponse(
                savedMessage.getId(),
                savedMessage.getSenderId(),
                savedMessage.getRecipientId(),
                savedMessage.getEncryptedMessage(),
                savedMessage.getTimestamp()
        );
    }

    public List<MessageResponse> getMessagesBetweenUsers(String user1Id, String user2Id) {
        // Validate that both users exist
        if (!userRepository.existsById(user1Id)) {
            throw new UserNotFoundException("User not found: " + user1Id);
        }

        if (!userRepository.existsById(user2Id)) {
            throw new UserNotFoundException("User not found: " + user2Id);
        }

        List<Message> messages = messageRepository.findMessagesBetweenUsers(user1Id, user2Id);

        return messages.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public List<MessageResponse> getNewMessagesForRecipient(String recipientId, Long lastMessageId) {
        if (!userRepository.existsById(recipientId)) {
            throw new UserNotFoundException("Recipient not found: " + recipientId);
        }

        List<Message> messages;
        if (lastMessageId == null || lastMessageId == 0) {
            messages = messageRepository.findAllMessagesForRecipient(recipientId);
        } else {
            messages = messageRepository.findNewMessagesForRecipient(recipientId, lastMessageId);
        }

        return messages.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public List<MessageResponse> getAllMessagesForUser(String userId) {
        if (!userRepository.existsById(userId)) {
            throw new UserNotFoundException("User not found: " + userId);
        }

        List<Message> messages = messageRepository.findAllMessagesForRecipient(userId);

        return messages.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public MessageResponse getMessageById(Long messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found: " + messageId));

        return convertToResponse(message);
    }

    private MessageResponse convertToResponse(Message message) {
        return new MessageResponse(
                message.getId(),
                message.getSenderId(),
                message.getRecipientId(),
                message.getEncryptedMessage(),
                message.getTimestamp()
        );
    }

    private String generateChatId(String user1, String user2) {
        return user1.compareTo(user2) < 0 ? user1 + "_" + user2 : user2 + "_" + user1;
    }
}